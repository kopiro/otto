import { Signale } from "signale";
import config from "../../config";
import { QDrantSDK } from "../../lib/qdrant";
import { OpenAIApiSDK } from "../../lib/openai";
import { ChatCompletionRequestMessageRoleEnum } from "openai";
import fetch from "node-fetch";
import { Interaction, TInteraction } from "../../data/interaction";
import { isDocument } from "@typegoose/typegoose";
import { IIOChannel, TIOChannel } from "../../data/io-channel";
import { MemoryEpisode, TMemoryEpisode } from "../../data/memory-episode";

const TAG = "VectorMemory";
const logger = new Signale({
  scope: TAG,
});

const REDUCED_MAX_CHARS = 300;

export enum MemoryType {
  "episodic" = "episodic",
  "declarative" = "declarative",
}

type GroupedInteractionsByIOChannel = Record<string, TInteraction[]>;
type GroupedInteractionsByDayThenIOChannel = Record<number, GroupedInteractionsByIOChannel>;

type QdrantPayload = {
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

    return QDrantSDK().createCollection(collection, {
      vectors: {
        size: 1536, // this is text-embedding-ada-002 vector size
        distance: "Cosine",
      },
      quantization_config: {
        scalar: {
          type: "int8",
          quantile: 0.99,
          always_ram: false,
        },
      },
    });
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

  async searchByText(text: string, memoryType: MemoryType): Promise<string[]> {
    const vector = await this.createEmbedding(text);
    return this.searchByVector(vector, memoryType);
  }

  async searchByVector(vector: number[], memoryType: MemoryType): Promise<string[]> {
    const data = await QDrantSDK().search(memoryType, {
      vector: vector,
      with_payload: true,
      with_vector: false,
      limit: 5,
      params: {
        quantization: {
          ignore: false,
          rescore: true,
        },
      },
    });

    return data.map((e) => (e.payload as QdrantPayload).text as string);
  }

  private async saveMemoryInQdrant(text: string, date: Date, memoryType: MemoryType): Promise<boolean> {
    // Split the text into sentences by splitting lines
    const sentences = text
      .split("\n")
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
      .filter((e) => !e.startsWith("//"));

    const vectors = await Promise.all(sentences.map((sentence) => this.createEmbedding(sentence)));

    const operation = await QDrantSDK().upsert(memoryType, {
      wait: true,
      batch: {
        ids: sentences.map((_, i) => i),
        vectors: vectors.map((e) => e),
        payloads: sentences.map(
          (e) =>
            ({
              text: e,
              date: date.toISOString(),
            } as QdrantPayload),
        ),
      },
    });

    return operation.status === "completed";
  }

  private async markInteractionsAsReduced(interactionsIds: string[], memoryEpisode: TMemoryEpisode): Promise<void> {
    await Interaction.updateMany(
      { _id: { $in: interactionsIds } },
      { $set: { reducedTo: memoryEpisode.id } },
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

        await this.saveMemoryInQdrant(reducedText, date, MemoryType.episodic);
        logger.info("Saved into memory");

        // Save it in the database (as whole text)
        const memoryEpisode = await MemoryEpisode.create({
          managerUid: config().uid,
          text: reducedText,
          date,
          ioChannel,
          createdAt: new Date(),
        });

        await this.markInteractionsAsReduced(interactionIds, memoryEpisode);
        logger.info(`Marked ${interactionIds.length} interactions as reduced to <${memoryEpisode.id}>`);
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

    const declarativeMemory = await (await fetch(config().openai.declarativeMemoryUrl)).text();
    logger.info("Declarative memory", declarativeMemory);

    await this.saveMemoryInQdrant(declarativeMemory, new Date(), MemoryType.declarative);
    logger.info("Saved declarative memory");
  }
}
