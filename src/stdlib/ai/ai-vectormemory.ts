import { Signale } from "signale";
import config from "../../config";
import { QDrantSDK } from "../../lib/qdrant";
import { OpenAIApiSDK } from "../../lib/openai";
import { ChatCompletionRequestMessageRoleEnum } from "openai";
import fetch from "node-fetch";
import { Interaction, TInteraction } from "../../data/interaction";
import { isDocument } from "@typegoose/typegoose";

const TAG = "VectorMemory";
const logger = new Signale({
  scope: TAG,
});

type MemoryType = "episodic" | "declarative";

type GroupedInteractionsBySession = Record<string, TInteraction[]>;
type GroupedInteractionsByDayThenSession = Record<number, GroupedInteractionsBySession>;

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

  private async getInteractionsGroupedByDayThenSession(): Promise<GroupedInteractionsByDayThenSession> {
    const unreducedInteractions = await Interaction.find({
      managerUid: config().uid,
      reducedAt: { $exists: false },
      $or: [
        { "fulfillment.text": { $exists: true }, source: "text" },
        { "fulfillment.text": { $exists: true }, source: "audio" },
        { "input.text": { $exists: true } },
      ],
    }).sort({ createdAt: +1 });

    const groupedInteractionsByDayThenSession = unreducedInteractions.reduce((acc, interaction) => {
      if (isDocument(interaction.ioChannel)) {
        const day = Math.floor(interaction.createdAt.getTime() / (1000 * 60 * 60 * 24));
        acc[day] = acc[day] || {};
        acc[day][interaction.ioChannel.id] = acc[day][interaction.ioChannel.id] || [];
        acc[day][interaction.ioChannel.id].push(interaction);
      }
      return acc;
    }, {} as GroupedInteractionsByDayThenSession);

    return groupedInteractionsByDayThenSession;
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

  private async save(text: string, date: Date, memoryType: MemoryType): Promise<boolean> {
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

  private async markInteractionsAsReduced(interactionsIds: string[]): Promise<void> {
    await Interaction.updateMany(
      { _id: { $in: interactionsIds } },
      { $set: { reducedAt: new Date() } },
      { multi: true },
    );
  }

  private async reduceInteractionsOfTheDay(
    forDate: Date,
    groupedInteractions: GroupedInteractionsBySession,
  ): Promise<string> {
    const { aiName } = config();
    const interactionsText = [];

    for (const [_, interactions] of Object.entries(groupedInteractions)) {
      const ioChannel = interactions[0].ioChannel;
      if (!isDocument(ioChannel)) {
        logger.error("Unable to continue without a ioChannel");
        continue;
      }

      interactionsText.push(`Conversation ${ioChannel.getDriverName()}`);

      for (const interaction of interactions) {
        const time = interaction.createdAt.toLocaleTimeString();

        if (interaction.fulfillment?.text) {
          interactionsText.push(`${aiName} (${time}): ${interaction.fulfillment.text}`);
        }
        if (interaction.input?.text) {
          interactionsText.push(`${interaction.getPersonName()} (${time}): ${interaction.input.text}`);
        }
      }

      interactionsText.push("\n");
    }

    const reducedPrompt =
      `I have the following interactions, happening on ${forDate.toDateString()}, please reduce them to a single sentence` +
      `Keep it short and compact, only keep necessary informations.` +
      `Include the date of the conversations in the output.\n\n` +
      interactionsText.join("\n");

    logger.debug("Reduced prompt:\n", reducedPrompt);

    const reducedMemory = await OpenAIApiSDK().createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: ChatCompletionRequestMessageRoleEnum.System,
          content: reducedPrompt,
        },
      ],
    });
    return reducedMemory.data.choices[0].message.content;
  }

  /**
   * The episodic memory is created by reducing all the interactions of a day to a single sentence.
   * This is done by using the GPT-3 chat model to reduce the interactions to a single sentence.
   * The reduced sentence is then saved to Qdrant.
   * The interactions are then marked as reduced.
   */
  async createEpisodicMemory() {
    await this.createQdrantCollection("episodic");

    const interactions = await this.getInteractionsGroupedByDayThenSession();
    logger.info("Found " + Object.keys(interactions).length + " total days to reduce");

    for (const day in interactions) {
      try {
        const forDate = new Date(Number(day) * 1000 * 60 * 60 * 24);
        logger.info(`Reducing interactions for Date: ${forDate.toDateString()}`);

        // Extract all interactions IDs
        const allInteractionIds = Object.values(interactions[day]).reduce<string[]>((acc, interactions) => {
          interactions.forEach((interaction) => acc.push(interaction.id));
          return acc;
        }, []);

        logger.info(`Found ${allInteractionIds.length} interactions to reduce`);
        const reducedInteractionText = await this.reduceInteractionsOfTheDay(forDate, interactions[day]);

        logger.debug("Reduced text:\n", reducedInteractionText);

        await this.save(reducedInteractionText, forDate, "episodic");
        logger.info("Saved into memory");

        await this.markInteractionsAsReduced(allInteractionIds);
        logger.info(`Marked ${allInteractionIds.length} interactions as reduced`);
      } catch (err) {
        logger.error(`Error reducing interactions`, err);
      }
    }
  }

  /**
   * The declarative memory is created by getting all informations (documents) from several links and saving them to Qdrant.
   */
  async createDeclarativeMemory(): Promise<void> {
    await this.createQdrantCollection("declarative");

    const declarativeMemory = await (await fetch(config().openai.declarativeMemoryUrl)).text();
    logger.info("Declarative memory", declarativeMemory);

    await this.save(declarativeMemory, new Date(), "declarative");
    logger.info("Saved declarative memory");
  }
}
