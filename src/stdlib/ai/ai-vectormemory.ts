import { Signale } from "signale";
import config from "../../config";
import { QDrantSDK } from "../../lib/qdrant";
import { OpenAIApiSDK } from "../../lib/openai";
import { ChatCompletionRequestMessageRoleEnum } from "openai";
import fetch from "node-fetch";
import { Interaction, TInteraction } from "../../data/interaction";
import { isDocument } from "@typegoose/typegoose";
import { TIOChannel } from "../../data/io-channel";
import { getFacebookFeed } from "../../lib/facebook";
import { md5 } from "../../helpers";
import uuidByString from "uuid-by-string";

const TAG = "VectorMemory";
const logger = new Signale({
  scope: TAG,
});

const REDUCED_MAX_CHARS = 300;
const SEARCH_LIMIT = 10;

export enum MemoryType {
  "episodic" = "episodic",
  "declarative" = "declarative",
}

type GroupedInteractionsByIOChannel = Record<string, TInteraction[]>;
type GroupedInteractionsByDayThenIOChannel = Record<number, GroupedInteractionsByIOChannel>;

type QdrantPayload = {
  id: string;
  text: string;
  date: string;
};

export class AIVectorMemory {
  private static instance: AIVectorMemory;
  static getInstance(): AIVectorMemory {
    if (!AIVectorMemory.instance) {
      AIVectorMemory.instance = new AIVectorMemory();
    }
    return AIVectorMemory.instance;
  }

  async createQdrantCollection(collection: MemoryType) {
    logger.debug("Creating Qdrant collection", collection);

    const allCollections = await QDrantSDK().getCollections();
    if (allCollections.collections.find((e) => e.name === collection)) {
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

  async deleteQdrantCollection(collection: MemoryType) {
    logger.debug("Deleting Qdrant collection", collection);
    return QDrantSDK().deleteCollection(collection);
  }

  private async getInteractionsGroupedByDayThenIOChannel(): Promise<GroupedInteractionsByDayThenIOChannel> {
    // Get all intereactions which "reducedTo" is not set
    const unreducedInteractions = await Interaction.find({
      managerUid: config().uid,
      reducedTo: { $exists: false },
      $or: [{ "fulfillment.text": { $exists: true } }, { "input.text": { $exists: true } }],
    }).sort({ createdAt: +1 });

    return unreducedInteractions.reduce((acc, interaction) => {
      if (isDocument(interaction.ioChannel)) {
        const day = Math.floor(interaction.createdAt.getTime() / (1000 * 60 * 60 * 24));
        acc[day] = acc[day] || {};
        acc[day][interaction.ioChannel.id] = acc[day][interaction.ioChannel.id] || [];
        acc[day][interaction.ioChannel.id].push(interaction);
      }
      return acc;
    }, {} as GroupedInteractionsByDayThenIOChannel);
  }

  async createEmbedding(text: string) {
    const { data } = await OpenAIApiSDK().createEmbedding({
      input: text,
      model: "text-embedding-ada-002",
    });
    return data.data[0].embedding;
  }

  async searchByText(text: string, memoryType: MemoryType, limit: number = SEARCH_LIMIT): Promise<string[]> {
    const vector = await this.createEmbedding(text);
    return this.searchByVector(vector, memoryType, limit);
  }

  async searchByVector(vector: number[], memoryType: MemoryType, limit: number = SEARCH_LIMIT): Promise<string[]> {
    const data = await QDrantSDK().search(memoryType, {
      vector: vector,
      with_payload: true,
      with_vector: false,
      limit,
    });

    // logger.debug(`Search by vector in ${memoryType} memory`, data);

    return data.map((e) => (e.payload as QdrantPayload).text as string);
  }

  private chunkText(text: string): string[] {
    return text
      .split("\n")
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
      .filter((e) => !e.startsWith("//"));
  }

  private async saveMemoriesInQdrant(payloads: QdrantPayload[], memoryType: MemoryType): Promise<boolean> {
    const vectors = await Promise.all(payloads.map(({ text }) => this.createEmbedding(text)));

    logger.info("Saving payloads in Qdrant", payloads);

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

    logger.info("Operation:", operation);

    return operation.status === "completed";
  }

  private async markInteractionsAsReduced(interactionsIds: string[], identifier: string): Promise<void> {
    await Interaction.updateMany(
      { _id: { $in: interactionsIds } },
      { $set: { reducedTo: identifier } },
      { multi: true },
    );
  }

  private async reduceText(date: Date, ioChannel: TIOChannel, text: string) {
    const promptToReduce =
      `The following is a conversation where ${config().aiName} is involved.\n` +
      `They have happened on date ${date.toDateString()} - ${ioChannel.getDriverName()}.\n` +
      `Please reduce them to a single sentence in third person.\n` +
      `Strictly keep the output short of maximum ${REDUCED_MAX_CHARS} characters.\n` +
      `If the informations don't fit in the limit, discard some informations.\n` +
      `Include the names, the date and the title of conversations in the output.` +
      `Example: On 27/02/2023, ${config().aiName} had a chat with USER about holidays in Japan."\n\n` +
      "## CONVERSATION:\n" +
      text;

    // logger.debug("Reducer prompt:\n", promptToReduce);

    const reducedMemory = await OpenAIApiSDK().createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: ChatCompletionRequestMessageRoleEnum.System,
          content: promptToReduce,
        },
      ],
    });
    return reducedMemory.data.choices[0].message.content;
  }

  private async reduceInteractionsForDate(date: Date, gInteractions: GroupedInteractionsByIOChannel) {
    logger.info(`Reducing interactions for Date: ${date.toDateString()}`);

    for (const interactions of Object.values(gInteractions)) {
      try {
        const ioChannel = interactions[0].ioChannel;
        if (!isDocument(ioChannel)) {
          logger.error("Unable to continue without a ioChannel");
          continue;
        }

        if (ioChannel.ioDriver === "voice" || ioChannel.ioDriver === "web") {
          logger.info("Skipping <voice> and <web> interactions");
          continue;
        }

        const interactionIdentifier = `${ioChannel.id}_${date.toISOString()}`;
        const interactionsText = [];
        const interactionIds = [];

        for (const interaction of interactions) {
          interactionIds.push(interaction.id);

          const time = interaction.createdAt.toLocaleTimeString();
          const sourceName = interaction.getSourceName();

          if (interaction.fulfillment?.text) {
            interactionsText.push(`${sourceName} (${time}): ${interaction.fulfillment.text}`);
          }
          if (interaction.input?.text) {
            interactionsText.push(`${sourceName} (${time}): ${interaction.input.text}`);
          }
        }

        const reducedText = await this.reduceText(date, ioChannel, interactionsText.join("\n"));
        logger.debug("Reduced text: ", reducedText);

        const payloads: QdrantPayload[] = this.chunkText(reducedText).map((text) => ({
          id: uuidByString(text),
          text,
          date: date.toISOString(),
        }));

        await this.saveMemoriesInQdrant(payloads, MemoryType.episodic);
        logger.info("Saved into memory");

        await this.markInteractionsAsReduced(interactionIds, interactionIdentifier);
        logger.info(`Marked ${interactionIds.length} interactions as reduced to <${interactionIdentifier}>`);
      } catch (err) {
        logger.error("Error reducing interactions", err.message);
      }
    }
  }

  /**
   * The episodic memory is created by reducing all the interactions of a day to a single sentence.
   * This is done by using the GPT-3 chat model to reduce the interactions to a single sentence.
   * The reduced sentence is then saved to Qdrant.
   * The interactions are then marked as reduced.
   */
  async createEpisodicMemory() {
    await this.createQdrantCollection(MemoryType.episodic);

    const interactions = await this.getInteractionsGroupedByDayThenIOChannel();
    logger.info("Found " + Object.keys(interactions).length + " total days to reduce: ", Object.keys(interactions));

    for (const day in interactions) {
      const date = new Date(Number(day) * 1000 * 60 * 60 * 24);
      await this.reduceInteractionsForDate(date, interactions[day]);
    }
  }

  /**
   * The declarative memory is created by getting all informations (documents) from several links and saving them to Qdrant.
   */
  async createDeclarativeMemory(): Promise<void> {
    await this.createQdrantCollection(MemoryType.declarative);

    try {
      logger.info("Fetching Memory by URL");

      const declarativeMemory = await (await fetch(config().openai.declarativeMemoryUrl)).text();
      logger.info("Declarative memory", declarativeMemory);

      const payloads: QdrantPayload[] = this.chunkText(declarativeMemory).map((text) => ({
        id: uuidByString(`declarative_${text}`),
        text,
        date: "",
      }));

      await this.saveMemoriesInQdrant(payloads, MemoryType.declarative);
      logger.info("Saved declarative memory");
    } catch (err) {
      logger.error(err);
    }

    try {
      logger.info("Fetching Memory by Facebook Page");
      const facebookFeed = await getFacebookFeed();

      const payloads: QdrantPayload[] = facebookFeed.data
        .map((item) => {
          const date = new Date(item.created_time);
          const text = [];
          if (!item.message) {
            return;
          }

          text.push(
            `On ${date.toISOString()}, ${config().aiName} posted a picture on Facebook/Instagram: "${item.message}"`,
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
            id: uuidByString(`facebook_${item.id}`),
            text: fText,
            date: new Date(item.created_time).toISOString(),
          };
        })
        .filter(Boolean);

      await this.saveMemoriesInQdrant(payloads, MemoryType.declarative);
    } catch (err) {
      logger.error(err);
    }
  }
}
