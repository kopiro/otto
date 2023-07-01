import { Signale } from "signale";
import config from "../../config";
import { QDrantSDK } from "../../lib/qdrant";
import { OpenAIApiSDK } from "../../lib/openai";
import { ChatCompletionRequestMessageRoleEnum } from "openai";
import fetch from "node-fetch";
import { Interaction, TInteraction } from "../../data/interaction";
import { isDocument } from "@typegoose/typegoose";
import { getFacebookFeed } from "../../lib/facebook";
import uuidByString from "uuid-by-string";

const TAG = "VectorMemory";
const logger = new Signale({
  scope: TAG,
});

const PER_IOCHANNEL_REDUCED_MAX_CHARS = 100;
const PER_DAY_REDUCED_MAX_CHARS = 300;

export enum MemoryType {
  "episodic" = "episodic",
  "declarative" = "declarative",
  "social" = "social",
}

type GInteractionsByIOChannel = Record<string, TInteraction[]>;
type GInteractionsByDayThenIOChannel = Record<number, GInteractionsByIOChannel>;

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

  async deleteQdrantCollection(collection: MemoryType) {
    logger.debug("Deleting Qdrant collection", collection);
    return QDrantSDK().deleteCollection(collection);
  }

  private async getInteractionsGroupedByDayThenIOChannel(): Promise<GInteractionsByDayThenIOChannel> {
    // Get all intereactions which "reducedTo" is not set
    const unreducedInteractions = await Interaction.find({
      managerUid: config().uid,
      reducedTo: { $exists: false },
      $or: [{ "fulfillment.text": { $exists: true } }, { "input.text": { $exists: true } }],
      // Get createdAt until yesterday
      createdAt: { $lte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }).sort({ createdAt: +1 });

    return unreducedInteractions.reduce((acc, interaction) => {
      if (isDocument(interaction.ioChannel)) {
        const date = `${interaction.createdAt.getFullYear()}-${interaction.createdAt.getMonth()}-${interaction.createdAt.getDate()}`;
        acc[date] = acc[date] || {};
        acc[date][interaction.ioChannel.id] = acc[date][interaction.ioChannel.id] || [];
        acc[date][interaction.ioChannel.id].push(interaction);
      }
      return acc;
    }, {} as GInteractionsByDayThenIOChannel);
  }

  async createEmbedding(text: string) {
    const { data } = await OpenAIApiSDK().createEmbedding({
      input: text,
      model: "text-embedding-ada-002",
    });
    return data.data[0].embedding;
  }

  async searchByText(text: string, memoryType: MemoryType, limit: number): Promise<string[]> {
    const vector = await this.createEmbedding(text);
    return this.searchByVector(vector, memoryType, limit);
  }

  async searchByVector(vector: number[], memoryType: MemoryType, limit: number): Promise<string[]> {
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

    logger.info(`Saving payloads in Qdrant <${memoryType}>`, payloads);

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

    logger.success(`Saved payloads in Qdrant <${memoryType}>`, operation);

    return operation.status === "completed";
  }

  private async markInteractionsAsReduced(interactionsIds: string[], identifier: string): Promise<void> {
    await Interaction.updateMany(
      { _id: { $in: interactionsIds } },
      { $set: { reducedTo: identifier } },
      { multi: true },
    );
  }

  private async openAIPrompt(text: string) {
    const reducedMemory = await OpenAIApiSDK().createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: ChatCompletionRequestMessageRoleEnum.System,
          content: text,
        },
      ],
    });
    return reducedMemory.data.choices[0].message.content;
  }

  private async reduceInteractionsForDate(date: string, gInteractions: GInteractionsByIOChannel) {
    logger.info(`Reducing interactions for Date: ${date}`);

    const reducedInteractionsPerIOChannelText = [];
    const interactionIds = [];

    for (const interactions of Object.values(gInteractions)) {
      try {
        const ioChannel = interactions[0].ioChannel;
        if (!isDocument(ioChannel)) {
          logger.error("Unable to continue without a ioChannel");
          continue;
        }

        if (ioChannel.ioDriver === "voice" || ioChannel.ioDriver === "web") {
          logger.warn(`Skipping interaction <${ioChannel.ioDriver}> because it's not supported yet`);
          continue;
        }

        const interactionsPerDayPerIOChannelText = [];

        for (const interaction of interactions) {
          interactionIds.push(interaction.id);

          const time = interaction.createdAt.toLocaleTimeString();
          const sourceName = interaction.getSourceName();

          if (interaction.fulfillment?.text) {
            interactionsPerDayPerIOChannelText.push(`- ${sourceName} (${time}): ${interaction.fulfillment.text}`);
          }
          if (interaction.input?.text) {
            interactionsPerDayPerIOChannelText.push(`- ${sourceName} (${time}): ${interaction.input.text}`);
          }
        }

        const reducerPromptForIOChannel =
          `The following is a conversation where ${config().aiName} is involved.\n` +
          `They have happened on date ${date} - ${ioChannel.getDriverName()}.\n` +
          `Please reduce them to a single sentence in third person.\n` +
          `Strictly keep the output short, maximum ${PER_IOCHANNEL_REDUCED_MAX_CHARS} characters.\n` +
          `Include the names, the date and the title of chat in the output.` +
          `Example: On 27/02/2023, ${config().aiName} had a chat with USER about holidays in Japan."\n\n` +
          "## Conversation:\n" +
          interactionsPerDayPerIOChannelText.join("\n");

        const reducedText = await this.openAIPrompt(reducerPromptForIOChannel);
        logger.debug("Reduced conversation: ", reducedText);

        reducedInteractionsPerIOChannelText.push(`- ${reducedText}`);
      } catch (err) {
        logger.error("Error reducing interactions", err.message);
      }
    }

    const reducerPromptForDay =
      `Compress the following sentences to a single sentence in third person.\n` +
      `Strictly keep the output short, maximum ${PER_DAY_REDUCED_MAX_CHARS} characters.\n\n` +
      `If the informations don't fit in the limit, discard some informations.\n` +
      `## Sentences:\n` +
      reducedInteractionsPerIOChannelText.join("\n");

    const reducedTextForDay = await this.openAIPrompt(reducerPromptForDay);
    logger.debug("Reduced sentences: ", reducedTextForDay);

    const payloads: QdrantPayload[] = this.chunkText(reducedTextForDay).map((text) => ({
      id: uuidByString(text),
      text,
      date: date,
    }));

    await this.saveMemoriesInQdrant(payloads, MemoryType.episodic);
    await this.markInteractionsAsReduced(interactionIds, date);
    logger.success(`Marked ${interactionIds.length} interactions as reduced`);
  }

  /**
   * The episodic memory is created by reducing all the interactions of a day to a single sentence.
   * This is done by using the GPT-3 chat model to reduce the interactions to a single sentence.
   * The reduced sentence is then saved to Qdrant.
   * The interactions are then marked as reduced.
   */
  async buildEpisodicMemory() {
    await this.createQdrantCollection(MemoryType.episodic);

    const interactions = await this.getInteractionsGroupedByDayThenIOChannel();
    logger.info("Found " + Object.keys(interactions).length + " total days to reduce: ", Object.keys(interactions));

    for (const day in interactions) {
      await this.reduceInteractionsForDate(day, interactions[day]);
    }
  }

  /**
   * The declarative memory is created by getting all informations (documents) from several links and saving them to Qdrant.
   */
  async buildDeclarativeMemory(): Promise<void> {
    await this.createQdrantCollection(MemoryType.declarative);

    logger.pending("Fetching Memory by URL...");

    const declarativeMemory = await (await fetch(config().openai.declarativeMemoryUrl)).text();

    const payloads: QdrantPayload[] = this.chunkText(declarativeMemory).map((text) => ({
      id: uuidByString(`declarative_${text}`),
      text,
      date: "",
    }));

    await this.saveMemoriesInQdrant(payloads, MemoryType.declarative);
  }

  async buildSocialMemory(): Promise<void> {
    await this.createQdrantCollection(MemoryType.social);

    logger.pending("Fetching Memory by Facebook Page...");
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

    await this.saveMemoriesInQdrant(payloads, MemoryType.social);
  }
}
