import { Signale } from "signale";
import config from "../../config";
import { QDrantSDK } from "../../lib/qdrant";
import { OpenAISDK } from "../../lib/openai";
import fetch from "node-fetch";
import { Interaction, TInteraction } from "../../data/interaction";
import { DocumentType, isDocument } from "@typegoose/typegoose";
import { FacebookFeedItem, getFacebookFeed } from "../../lib/facebook";
import { IIOChannel, TIOChannel } from "../../data/io-channel";
import { AIBrain } from "./ai-brain";
import getUuidByString from "uuid-by-string";

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { TPerson } from "../../data/person";

const rl = readline.createInterface({ input: stdin, output: stdout });

const TAG = "AIMemory";
const logger = new Signale({
  scope: TAG,
});

const EMBEDDING_MODEL = "text-embedding-ada-002";

export enum MemoryType {
  "episodic" = "episodic",
  "declarative" = "declarative",
  "social" = "social",
}

type InteractionsByIOChannelIDByChunk = Record<string, Record<string, TInteraction[]>>;
type ReducedInteractionsMemoryPayloadsByChunk = Array<{
  chunkId: string;
  dateChunk: string;
  ioChannel: TIOChannel;
  interactions: TInteraction[];
  payloads: QdrantPayload[];
}>;

type QdrantPayload = {
  id: string;
  chunkId?: string;
  text: string;
};

type Config = {
  promptUrl: string;
  declarativeMemoryUrl: string;
  interactionLimitHours: number;
  interactionLimitCount: number;
  vectorial: {
    declarative: {
      limit: number;
      scoreThreshold: number;
    };
    episodic: {
      limit: number;
      scoreThreshold: number;
    };
    social: {
      limit: number;
      scoreThreshold: number;
    };
  };
};

export class AIMemory {
  private static instance: AIMemory;

  constructor(public conf: Config) {}

  static getInstance(): AIMemory {
    if (!AIMemory.instance) {
      AIMemory.instance = new AIMemory(config().memory);
    }
    return AIMemory.instance;
  }

  async getRecentInteractions(ioChannel: TIOChannel, person: TPerson) {
    // Get all Interaction where we have a input.text or output.text in the last 20m
    return await Interaction.find({
      $or: [
        {
          "output.text": { $ne: null },
          ioChannel: ioChannel.id,
          reducedTo: { $exists: false },
        },
        {
          "input.text": { $ne: null },
          ioChannel: ioChannel.id,
          reducedTo: { $exists: false },
        },
        {
          "output.text": { $ne: null },
          person: person.id,
          reducedTo: { $exists: false },
        },
        {
          "input.text": { $ne: null },
          person: person.id,
          reducedTo: { $exists: false },
        },
      ],
    })
      .sort({ createdAt: -1 })
      .where({
        createdAt: {
          $gt: new Date(Date.now() - this.conf.interactionLimitHours * 1000 * 60 * 60),
        },
      })
      .limit(this.conf.interactionLimitCount);
  }

  async createCollection(collection: MemoryType) {
    logger.debug("Creating Qdrant collection", collection);

    const allCollections = await QDrantSDK().getCollections();
    if (allCollections.collections.find((e) => e.name === collection)) {
      logger.debug("Qdrant collection already exists", collection);
      return;
    }

    await QDrantSDK().createCollection(collection, {
      vectors: {
        size: 1536, // this is text-embedding-ada-002 vector size
        distance: "Cosine",
      },
    });

    return true;
  }

  async deleteCollection(collection: MemoryType) {
    const op = await QDrantSDK().deleteCollection(collection);
    logger.success(`Deleted Qdrant collection (${collection})`, op);
  }

  private getDateChunk(date: Date): string {
    // Returns the date in format YYYY/MM/DD
    return [
      date.getFullYear(),
      (1 + date.getMonth()).toString().padStart(2, "0"),
      date.getDate().toString().padStart(2, "0"),
    ].join("-");
  }

  private async getInteractionByIOChannelIDByDateChunk(): Promise<InteractionsByIOChannelIDByChunk> {
    // Get all intereactions which "reducedTo" is not set
    const unreducedInteractions = await Interaction.find({
      reducedTo: { $exists: false },
      managerUid: config().uid,
    }).sort({ createdAt: +1 });

    return unreducedInteractions.reduce<InteractionsByIOChannelIDByChunk>((acc, interaction) => {
      if (isDocument(interaction.ioChannel)) {
        const dateChunk = this.getDateChunk(interaction.createdAt);
        acc[dateChunk] = acc[dateChunk] || {};
        acc[dateChunk][interaction.ioChannel.id] = acc[dateChunk][interaction.ioChannel.id] || [];
        acc[dateChunk][interaction.ioChannel.id].push(interaction);
      }
      return acc;
    }, {});
  }

  async createVector(text: string) {
    const { data } = await OpenAISDK().embeddings.create({
      input: text,
      model: EMBEDDING_MODEL,
    });
    return data[0].embedding;
  }

  async searchByText(text: string, memoryType: MemoryType, limit: number, scoreThreshold: number) {
    const vector = await this.createVector(text);
    return this.searchByVector(vector, memoryType, limit, scoreThreshold);
  }

  async searchByVector(vector: number[], memoryType: MemoryType, limit: number, scoreThreshold: number) {
    const data = await QDrantSDK().search(memoryType, {
      score_threshold: scoreThreshold,
      vector,
      with_payload: true,
      with_vector: false,
      limit,
    });

    return data;
  }

  async searchByVectors(vector: number[][], memoryType: MemoryType, limit: number, scoreThreshold: number) {
    return Promise.all(vector.map((v) => this.searchByVector(v, memoryType, limit, scoreThreshold))).then((results) =>
      results.flat(),
    );
  }

  async listVectors(memoryType: MemoryType) {
    const data = await QDrantSDK().scroll(memoryType, {
      with_payload: true,
      with_vector: false,
    });
    return data.points.map((e) => ({ id: e.id, ...e.payload }));
  }

  async deleteVector(id: string, memoryType: MemoryType) {
    const result = await QDrantSDK().delete(memoryType, {
      points: [id],
    });
    logger.success(`Deleted vector ${id} from collection ${memoryType}`, result);
    return result;
  }

  private chunkText(text: string): string[] {
    return text
      .split("\n")
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
      .filter((e) => !e.startsWith("//"));
  }

  private async savePayloadInCollection(payloads: QdrantPayload[], memoryType: MemoryType): Promise<boolean> {
    if (payloads.length === 0) {
      return true;
    }

    const vectors = await Promise.all(payloads.map(({ text }) => this.createVector(text)));
    logger.debug(`Reduced payloads into vectors`, payloads);

    try {
      const operation = await QDrantSDK().upsert(memoryType, {
        wait: true,
        batch: {
          // Use uuid-by-string to generate ids that are compatible with the Qdrant API
          ids: payloads.map(({ id }) => getUuidByString(id)),
          vectors: vectors,
          payloads: payloads.map((e) => {
            // Remove ids
            const { id, ...payload } = e;
            return payload;
          }),
        },
      });

      logger.success(`Saved vectors in collection <${memoryType}>`, operation);

      return operation.status === "completed";
    } catch (err) {
      logger.error(`Error when saving payloads in collection <${memoryType}>`, err);
      return false;
    }
  }

  private async markInteractionsAsReduced(interactionsIds: string[], reducedTo: string) {
    await Interaction.updateMany(
      { _id: { $in: interactionsIds } },
      { $set: { reducedTo: reducedTo } },
      { multi: true },
    );
    logger.success(`Marked ${interactionsIds.length} interactions as reduced to ${reducedTo}`);
  }

  async getReducedInteractionsMemoryPayloadsByChunk(): Promise<ReducedInteractionsMemoryPayloadsByChunk> {
    // Welcome back! If you change  the text, you may want to re-run the memory builder
    // MEMORY_TYPE=episodic REBUILD_MEMORY=true npm run ai:memory

    const unreducedInteractions = await this.getInteractionByIOChannelIDByDateChunk();
    logger.info(
      `Found ${Object.keys(unreducedInteractions).length} total days to reduce: `,
      Object.keys(unreducedInteractions),
    );

    const reducedInteractionsByChunk: ReducedInteractionsMemoryPayloadsByChunk = [];

    // Process all date chunks in parallel
    const dateChunkPromises = Object.entries(unreducedInteractions).map(
      async ([dateChunk, interactionsByChannelId]) => {
        // Process all channels for this date in parallel
        const channelPromises = Object.entries(interactionsByChannelId).map(async ([ioChannelId, interactions]) => {
          try {
            const chunkId = `iochannel_${ioChannelId}_date_${dateChunk}`;
            const ioChannel = interactions[0].ioChannel as DocumentType<IIOChannel>;

            // Process all interactions in parallel to build the conversation
            const conversationPromises = interactions.map(async (interaction) => {
              const time = interaction.createdAt.toLocaleTimeString();
              const sourceName = interaction.getSourceName();
              const messages = [];

              if (interaction.output && "text" in interaction.output) {
                messages.push(`- ${sourceName} (${time}): ${interaction.output.text}`);
              }
              if (interaction.input && "text" in interaction.input && interaction.input.role !== "system") {
                messages.push(`- ${sourceName} (${time}): ${interaction.input.text}`);
              }

              return messages;
            });

            const conversationArrays = await Promise.all(conversationPromises);
            const conversation = conversationArrays.flat();

            if (!conversation.length) {
              logger.debug("No conversation to reduce, skipping");
              return null;
            }

            const reducerPrompt = `
Compress the provided conversation while preserving its original meaning. 

Only if strictly necessary, separate different topics with a line break.
If the topics lose their meaning isolated, do not separate them.

STRICTLY, for each line/topic, use this format: 
On YYYY-MM-DD, [USER_A], [USER_B] and [USER_C] [talked about topic].

---

The conversation happened ${ioChannel.getName()} - Date: ${dateChunk}:

${conversation.join("\n")}`;

            logger.debug("Reducing conversation: ", reducerPrompt);

            const reducedText = await AIBrain.getInstance().reduceText(dateChunk, reducerPrompt);
            const reducedTextInChunks = this.chunkText(reducedText);

            const payloads = reducedTextInChunks.map<QdrantPayload>((chunkedText) => {
              return {
                id: getUuidByString(`${dateChunk}_${chunkedText}`),
                chunkId,
                dateChunk,
                text: chunkedText,
              };
            });

            return {
              chunkId,
              dateChunk,
              interactions,
              ioChannel,
              payloads,
            };
          } catch (err) {
            logger.error(`Error when reducing conversation`, err);
            return null;
          }
        });

        const results = await Promise.all(channelPromises);
        return results.filter((result): result is NonNullable<typeof result> => result !== null);
      },
    );

    const allResults = await Promise.all(dateChunkPromises);
    reducedInteractionsByChunk.push(...allResults.flat());

    return reducedInteractionsByChunk;
  }

  async reduceInteractionsForChunk(reducedInteractionsForChunk: ReducedInteractionsMemoryPayloadsByChunk) {
    for (const { interactions, payloads, chunkId } of Object.values(reducedInteractionsForChunk)) {
      await this.savePayloadInCollection(payloads, MemoryType.episodic);

      await this.markInteractionsAsReduced(
        interactions.map((e) => e.id),
        chunkId,
      );
    }
  }

  /**
   * The episodic memory is created by reducing all the interactions of a day to a single sentence.
   * The reduced sentence is then saved to Qdrant.
   * The interactions are then marked as reduced.
   */
  async buildEpisodicMemory() {
    await this.createCollection(MemoryType.episodic);

    const reducedInteractionsByChunk = await this.getReducedInteractionsMemoryPayloadsByChunk();
    await this.reduceInteractionsForChunk(reducedInteractionsByChunk);
  }

  private prompt!: string;

  public async getPrompt(refresh = false): Promise<string> {
    if (!this.prompt || refresh) {
      const prompt = await (await fetch(this.conf.promptUrl)).text();
      if (prompt) {
        this.prompt = prompt.replace(/\r\n/g, "\n").trim();
      } else {
        logger.error("Failed to retrieve prompt");
      }
    }
    return this.prompt;
  }

  public async getPromptMemory() {
    logger.pending("Fetching Prompt by URL..");

    const headerPrompt = await this.getPrompt();
    const chunks = this.chunkText(headerPrompt);

    return chunks.map((text) => ({
      id: `header_${text}`,
      text,
    }));
  }

  async getDeclarativeMemory() {
    logger.pending("Fetching Memory by URL...");

    const declarativeMemory = await (await fetch(this.conf.declarativeMemoryUrl)).text();
    const chunks = this.chunkText(declarativeMemory);

    const payloads = chunks.map((text) => ({
      id: `declarative_${text}`,
      text,
    }));

    return payloads;
  }

  /**
   * The declarative memory is created by getting all informations (documents) from several links and saving them to Qdrant.
   */
  async buildDeclarativeMemory() {
    // Always erase the declarative memory as it's easy to rebuilt
    await this.deleteCollection(MemoryType.declarative);
    await this.createCollection(MemoryType.declarative);

    const payloads = await this.getDeclarativeMemory();

    return this.savePayloadInCollection(payloads, MemoryType.declarative);
  }

  async getSocialMemory() {
    logger.pending("Fetching Memory by Facebook Page...");

    const facebookFeed = await getFacebookFeed();

    const items: (FacebookFeedItem & { uuid: string })[] = [];
    const processFeed = (feed: FacebookFeedItem[]) => {
      feed
        .filter((item) => item.message)
        .map((item) => ({ ...item, uuid: `facebook_${item.id}` }))
        .forEach((item) => items.push(item));
    };

    processFeed(facebookFeed.data);
    let next = facebookFeed.paging?.next;
    while (next) {
      const nextFeed = await fetch(next).then((res) => res.json());
      processFeed(nextFeed.data);
      next = nextFeed.paging?.next;
      logger.pending("Fetching next page of Facebook feed...");
    }
    logger.info("Found " + items.length + " Facebook posts");

    return items.map((item) => {
      const text = [];

      const dateString = item.created_time.split("T")[0];

      text.push(`On ${dateString}, ${config().aiName} posted a picture on social media: "${item.message}"`);
      if (item.permalink_url) {
        text.push(`(Link: ${item.permalink_url})`);
      }
      if (item.place) {
        text.push(`(Location: ${item.place.name} (${item.place.location.city}, ${item.place.location.country}))`);
      }

      // Remove any hashtags
      const fText = text
        .join(" ")
        .replace(/#[a-zA-Z0-9]+/g, "")
        .replace(/\n/g, "");

      return {
        id: `facebook_${item.uuid}`,
        text: fText,
      };
    });
  }

  /**
   * The social memory is created by getting all posts from Facebook and Instagram and saving them to Qdrant.
   */
  async buildSocialMemory() {
    await this.deleteCollection(MemoryType.social);
    await this.createCollection(MemoryType.social);

    const payloads = await this.getSocialMemory();

    return this.savePayloadInCollection(payloads, MemoryType.social);
  }
}
