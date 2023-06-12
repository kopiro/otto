import { Signale } from "signale";
import { Interaction, Session, LongTermMemory } from "../../data";
import { AIOpenAI } from "./openai";
import { Interaction as IInteraction, Session as ISession, LongTermMemory as ILongTermMemory } from "../../types";
import { getSessionName } from "../../helpers";
import config from "../../config";

const TAG = "LongTermMemoryReducer";
const console = new Signale({
  scope: TAG,
});

const MAX_CHARS = 300;

/**
 * This module is responsible for reducing the long term memory of the AI.
 * It will parse all the "Interaction" records in the database every 24 hours and reduce it using AI algorithms, then save it back to the table "LongTermMemory".
 */

type GroupedInteractionsBySession = Record<string, IInteraction[]>;
type GroupedInteractionsByDayThenSession = Record<number, GroupedInteractionsBySession>;

export class LongTermMemoryReducer {
  async getInteractionsGroupedByDayThenSession(): Promise<GroupedInteractionsByDayThenSession> {
    const unreducedInteractions = await Interaction.find({
      managerUid: config().uid,
      reducedLongTermMemory: { $exists: false },
      $or: [
        { "fulfillment.text": { $exists: true }, source: "text" },
        { "fulfillment.text": { $exists: true }, source: "audio" },
        { "input.text": { $exists: true } },
      ],
    }).sort({ createdAt: +1 });

    const groupedInteractionsByDayThenSession = unreducedInteractions.reduce((acc, interaction) => {
      const daySince1970 = Math.floor(interaction.createdAt.getTime() / (1000 * 60 * 60 * 24));
      acc[daySince1970] = acc[daySince1970] || {};
      acc[daySince1970][interaction.session.id] = acc[daySince1970][interaction.session.id] || [];
      acc[daySince1970][interaction.session.id].push(interaction);
      return acc;
    }, {} as GroupedInteractionsByDayThenSession);

    return groupedInteractionsByDayThenSession;
  }

  async saveLongTermMemory(forDate: Date, text: string): Promise<ILongTermMemory> {
    const longTermMemory = new LongTermMemory({
      managerUid: config().uid,
      text,
      createdAt: new Date(),
      type: "daily",
      forDate,
    });
    await longTermMemory.save();
    return longTermMemory;
  }

  async markInteractionsAsReduced(longTermMemory: ILongTermMemory, interactionsIds: string[]): Promise<void> {
    await Interaction.updateMany(
      { _id: { $in: interactionsIds } },
      { $set: { reducedLongTermMemory: longTermMemory.id } },
      { multi: true },
    );
  }

  async reduceInteractionsOfTheDay(
    forDate: Date,
    groupedInteractionsBySession: GroupedInteractionsBySession,
  ): Promise<string> {
    const { aiName } = config();
    const interactionsText = [];

    for (const [sessionId, interactions] of Object.entries(groupedInteractionsBySession)) {
      const sessionName = getSessionName(interactions[0].session);
      interactionsText.push(`Conversation with ${sessionName}:`);
      for (const interaction of interactions) {
        const time = interaction.createdAt.toLocaleTimeString();
        if (interaction.fulfillment.text) {
          interactionsText.push(`${aiName} (${time}): ${interaction.fulfillment.text}`);
        }
        if (interaction.input.text) {
          interactionsText.push(`USER (${time}): ${interaction.input.text}`);
        }
      }
      interactionsText.push("\n");
    }

    const reducerPrompt =
      `I have the following interactions between YOU and your friends, happening at ${forDate.toDateString()}, please reduce them to a single sentence. Keep the output as short as possible and, if possible, below ${MAX_CHARS} characters; try to only keep new informations and discard already known informations. In case of error, strictly return "ERROR".\n\n` +
      interactionsText.join("\n");

    const reducedMemory = await AIOpenAI.getInstance().getFulfillmentForInput(
      { text: reducerPrompt },
      null,
      "system",
      "none",
    );
    if (!reducedMemory.text || reducedMemory.text.toUpperCase() === "ERROR") {
      return "";
    }

    return reducedMemory.text;
  }

  async reduce(): Promise<void> {
    const interactions = await this.getInteractionsGroupedByDayThenSession();
    console.info("Found " + Object.keys(interactions).length + " total days to reduce");

    for (const day in interactions) {
      try {
        const forDate = new Date(Number(day) * 1000 * 60 * 60 * 24);
        console.info(`Reducing interactions for Date: ${forDate.toDateString()}`);

        // Extract all interactions IDs
        const allInteractionIds = Object.values(interactions[day]).reduce<string[]>((acc, interactions) => {
          interactions.forEach((interaction) => acc.push(interaction.id));
          return acc;
        }, []);

        console.info(`Found ${allInteractionIds.length} interactions to reduce`);
        const reducedInteractionText = await this.reduceInteractionsOfTheDay(forDate, interactions[day]);

        const longTermMemory = await this.saveLongTermMemory(forDate, reducedInteractionText);
        console.info(`Saved long term memory: ${longTermMemory.id}`);

        await this.markInteractionsAsReduced(longTermMemory, allInteractionIds);
        console.info(`Marked ${allInteractionIds.length} interactions as reduced`);
      } catch (err) {
        console.error(`Error reducing interactions`, err);
      }
    }
  }
}
