import { Signale } from "signale";
import config from "../../config";
import { QDrantSDK } from "../../lib/qdrant";
import { OpenAIApiSDK } from "../../lib/openai";
import fetch from "node-fetch";
import { Interaction, TInteraction } from "../../data/interaction";
import { DocumentType, isDocument } from "@typegoose/typegoose";
import { getFacebookFeed } from "../../lib/facebook";
import uuidByString from "uuid-by-string";
import { IIOChannel } from "../../data/io-channel";

const TAG = "VectorMemory";
const logger = new Signale({
  scope: TAG,
});

const PER_IOCHANNEL_REDUCED_MAX_CHARS = 100;
const PER_DATECHUNK_REDUCED_MAX_CHARS = 300;

export enum MemoryType {
  "episodic" = "episodic",
  "declarative" = "declarative",
  "social" = "social",
}

type MapIOChannelToInteractions = Record<string, TInteraction[]>;
type MapDateChunkToMapIOChannelToInteractions = Record<string, MapIOChannelToInteractions>;

type QdrantPayload = {
  id: string;
  text: string;
  dateChunk?: string;
};

export class AIVectorMemory {
  private static instance: AIVectorMemory;
  static getInstance(): AIVectorMemory {
    if (!AIVectorMemory.instance) {
      AIVectorMemory.instance = new AIVectorMemory();
    }
    return AIVectorMemory.instance;
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
    return [
      date.getFullYear(),
      (1 + date.getMonth()).toString().padStart(2, "0"),
      date.getDate().toString().padStart(2, "0"),
    ].join("/");
  }

  private async getInteractionsGroupedByDateChunkThenIOChannel(): Promise<MapDateChunkToMapIOChannelToInteractions> {
    // Get all intereactions which "reducedTo" is not set
    const unreducedInteractions = await Interaction.find({
      managerUid: config().uid,
      reducedTo: { $exists: false },
      $or: [{ "fulfillment.text": { $exists: true } }, { "input.text": { $exists: true } }],
    }).sort({ createdAt: +1 });

    return unreducedInteractions.reduce<MapDateChunkToMapIOChannelToInteractions>((acc, interaction) => {
      if (isDocument(interaction.ioChannel)) {
        if (interaction.ioChannel.ioDriver === "telegram") {
          const dateChunk = this.getDateChunk(interaction.createdAt);
          acc[dateChunk] = acc[dateChunk] || {};
          acc[dateChunk][interaction.ioChannel.id] = acc[dateChunk][interaction.ioChannel.id] || [];
          acc[dateChunk][interaction.ioChannel.id].push(interaction);
        }
      }
      return acc;
    }, {});
  }

  async createVector(text: string) {
    const { data } = await OpenAIApiSDK().embeddings.create({
      input: text,
      model: "text-embedding-ada-002",
    });
    return data[0].embedding;
  }

  async searchByText(text: string, memoryType: MemoryType, limit: number): Promise<string[]> {
    const vector = await this.createVector(text);
    return this.searchByVector(vector, memoryType, limit);
  }

  async searchByVector(vector: number[], memoryType: MemoryType, limit: number): Promise<string[]> {
    const data = await QDrantSDK().search(memoryType, {
      vector: vector,
      with_payload: true,
      with_vector: false,
      limit,
    });

    return data.map((e) => (e.payload as QdrantPayload).text as string);
  }

  async listVectors(memoryType: MemoryType) {
    const data = await QDrantSDK().scroll(memoryType, {
      with_payload: true,
      with_vector: false,
      limit: 10_000,
    });
    return data.points.map((e) => ({ id: e.id, ...e.payload }));
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

    const operation = await QDrantSDK().upsert(memoryType, {
      wait: true,
      batch: {
        ids: payloads.map(({ id }) => id),
        vectors: vectors,
        // Remove ids
        payloads: payloads.map((e) => {
          const { id, ...payload } = e;
          return payload;
        }),
      },
    });

    logger.success(`Saved payloads in collection <${memoryType}>`, operation);

    return operation.status === "completed";
  }

  private async markInteractionsAsReduced(interactionsIds: string[], reducedTo: string) {
    await Interaction.updateMany(
      { _id: { $in: interactionsIds } },
      { $set: { reducedTo: reducedTo } },
      { multi: true },
    );
    logger.success(`Marked ${interactionsIds.length} interactions as reduced to ${reducedTo}`);
  }

  private async reduceText(text: string) {
    const response = await OpenAIApiSDK().chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: text,
        },
      ],
    });
    const content = response?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Unable to reduce text");
    }
    return content;
  }

  private async reduceInteractionsForDateChunk(dateChunk: string, gInteractions: MapIOChannelToInteractions) {
    logger.info(`Reducing interactions for DateChunk: ${dateChunk}`);

    const reducedInteractionsPerIOChannelText = [];
    const interactionIds = [];

    for (const interactions of Object.values(gInteractions)) {
      try {
        const ioChannel = interactions[0].ioChannel as DocumentType<IIOChannel>;

        const conversation = [];

        for (const interaction of interactions) {
          interactionIds.push(interaction.id);
          4;
          const time = interaction.createdAt.toLocaleTimeString();
          const sourceName = interaction.getSourceName();

          if (interaction.fulfillment?.text) {
            conversation.push(`- ${sourceName} (${time}): ${interaction.fulfillment.text}`);
          }
          if (interaction.input && "text" in interaction.input) {
            conversation.push(`- ${sourceName} (${time}): ${interaction.input.text}`);
          }
        }

        if (conversation.length) {
          const reducerPromptForIOChannel =
            `The following is a conversation happened on ${dateChunk} - ${ioChannel.getDriverName()}.\n` +
            `Please reduce them to a single sentence in third person.\n` +
            `Strictly keep the output short, maximum ${PER_IOCHANNEL_REDUCED_MAX_CHARS} characters.\n` +
            `Include the names, the date and the title of the conversation.` +
            `Example: On 27/02/2023, ${
              config().aiName
            } had a chat with USER about holidays in Japan in that chat "Holidays"."\n\n` +
            "## Conversation:\n" +
            conversation.join("\n");

          // logger.debug("Reducing conversation: ", reducerPromptForIOChannel);

          const reducedText = await this.reduceText(reducerPromptForIOChannel);
          logger.debug("Reduced conversation: ", reducedText);

          reducedInteractionsPerIOChannelText.push(`- ${reducedText}`);
        }
      } catch (err) {
        logger.error(`Error when reducing conversation, proceeding anyway`, (err as Error).message);
      }
    }

    if (reducedInteractionsPerIOChannelText.length) {
      const reducerPromptForDay =
        `Compress the following sentences to a single sentence in third person.\n` +
        `Strictly keep the output short, maximum ${PER_DATECHUNK_REDUCED_MAX_CHARS} characters.\n\n` +
        `If the informations don't fit in the limit, discard some informations.\n` +
        `## Sentences:\n` +
        reducedInteractionsPerIOChannelText.join("\n");

      // logger.debug("Reducing sentences: ", reducerPromptForDay);

      const reducedTextForDay = await this.reduceText(reducerPromptForDay);
      logger.info("Reduced sentences: ", reducedTextForDay);

      // Delete all text belonging to this dateChunk
      const deleteOp = await QDrantSDK().delete(MemoryType.episodic, {
        wait: true,
        filter: {
          must: [
            {
              key: "dateChunk" as keyof QdrantPayload,
              match: {
                value: dateChunk,
              },
            },
          ],
        },
      });
      logger.success(`Deleted payloads for dateChunk: ${dateChunk}`, deleteOp);

      const payloads = this.chunkText(reducedTextForDay).map<QdrantPayload>((text) => ({
        id: uuidByString(dateChunk + "-" + text),
        text,
        dateChunk,
      }));

      await this.savePayloadInCollection(payloads, MemoryType.episodic);
    }

    await this.markInteractionsAsReduced(interactionIds, dateChunk);
  }

  /**
   * The episodic memory is created by reducing all the interactions of a day to a single sentence.
   * This is done by using the GPT-3 chat model to reduce the interactions to a single sentence.
   * The reduced sentence is then saved to Qdrant.
   * The interactions are then marked as reduced.
   */
  async buildEpisodicMemory() {
    await this.createCollection(MemoryType.episodic);

    const unreducedInteractions = await this.getInteractionsGroupedByDateChunkThenIOChannel();
    logger.info(
      "Found " + Object.keys(unreducedInteractions).length + " total days to reduce: ",
      Object.keys(unreducedInteractions),
    );

    for (const [dateChunk, gInteractions] of Object.entries(unreducedInteractions)) {
      await this.reduceInteractionsForDateChunk(dateChunk, gInteractions);
    }
  }

  /**
   * The declarative memory is created by getting all informations (documents) from several links and saving them to Qdrant.
   */
  async buildDeclarativeMemory() {
    // Always erase the declarative memory as it's easy to rebuilt
    await this.deleteCollection(MemoryType.declarative);
    await this.createCollection(MemoryType.declarative);

    logger.pending("Fetching Memory by URL...");

    const declarativeMemory = await (await fetch(config().openai.declarativeMemoryUrl)).text();

    const payloads = this.chunkText(declarativeMemory).map<QdrantPayload>((text) => ({
      id: uuidByString(`declarative_${text}`),
      text,
    }));

    return this.savePayloadInCollection(payloads, MemoryType.declarative);
  }

  /**
   * The social memory is created by getting all posts from Facebook and Instagram and saving them to Qdrant.
   */
  async buildSocialMemory() {
    await this.deleteCollection(MemoryType.social);
    await this.createCollection(MemoryType.social);

    logger.pending("Fetching Memory by Facebook Page...");
    const facebookFeed = await getFacebookFeed();

    const facebookData = facebookFeed.data
      .filter((item) => item.message)
      .map((item) => ({ ...item, uuid: uuidByString(`facebook_${item.id}`) }));

    const payloads = facebookData.map<QdrantPayload>((item) => {
      const text = [];

      text.push(
        `On ${new Date(item.created_time).toISOString()}, ${config().aiName} posted a picture on Facebook/Instagram: "${
          item.message
        }"`,
      );
      if (item.permalink_url) {
        text.push(`(Link: ${item.permalink_url})`);
      }
      if (item.place) {
        text.push(`(Location: ${item.place.name} (${item.place.location.city}, ${item.place.location.country})})`);
      }

      // Remove any hashtags
      let fText = text.join(" ");
      fText = fText.replace(/#[a-zA-Z0-9]+/g, ""); // Remove #hashtags
      fText = fText.replace(/\n/g, "");

      return {
        id: item.uuid,
        text: fText,
      };
    });

    return this.savePayloadInCollection(payloads, MemoryType.social);
  }
}
