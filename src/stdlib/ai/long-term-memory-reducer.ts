import { Signale } from "signale";
import { Interaction, Session, LongTermMemory } from "../../data";
import openai from "./openai";
import { Interaction as IInteraction, Session as ISession, LongTermMemory as ILongTermMemory } from "../../types";
import { getSessionName } from "../../helpers";
import config from "../../config";

const TAG = "LongTermMemoryReducer";
const console = new Signale({
  scope: TAG,
});

/**
 * This module is responsible for reducing the long term memory of the AI.
 * It will parse all the "Interaction" records in the database every 24 hours and reduce it using AI algorithms, then save it bac to the table "LongTermMemory".
 */

type GroupedInteractionsByDay = Record<number, IInteraction[]>;
type GroupedInteractionsBySessionAndDay = Record<string, GroupedInteractionsByDay>;

export class LongTermMemoryReducer {
  async getInteractionsGroupedBySessionAndDay(): Promise<GroupedInteractionsBySessionAndDay> {
    const unreducedInteractions = await Interaction.find({
      reducedLongTermMemory: { $exists: false },
    }).sort({ createdAt: -1 });

    const groupedInteractionsBySessionAndDay = unreducedInteractions.reduce((acc, interaction) => {
      if (!acc[interaction.session.id]) {
        acc[interaction.session.id] = [];
      }
      const daySince1970 = Math.floor(interaction.createdAt.getTime() / (1000 * 60 * 60 * 24));
      acc[interaction.session.id] = acc[interaction.session.id] || {};
      acc[interaction.session.id][daySince1970] = acc[interaction.session.id][daySince1970] || [];
      acc[interaction.session.id][daySince1970].push(interaction);
      return acc;
    }, {} as GroupedInteractionsBySessionAndDay);
    return groupedInteractionsBySessionAndDay;
  }

  async saveLongTermMemory(session: ISession, date: Date, text: string): Promise<ILongTermMemory> {
    const longTermMemory = new LongTermMemory({
      session,
      text,
      createdAt: new Date(),
      type: "daily",
      forDate: date,
    });
    await longTermMemory.save();
    return longTermMemory;
  }

  async markInteractionsAsReduced(longTermMemory: ILongTermMemory, interactions: IInteraction[]): Promise<void> {
    const interactionIds = interactions.map((interaction) => interaction.id);
    await Interaction.updateMany(
      { _id: { $in: interactionIds } },
      { $set: { reducedLongTermMemory: longTermMemory.id } },
      { multi: true },
    );
  }

  async reduceInteractions(session: ISession, interactions: IInteraction[]): Promise<string> {
    const interactionsText = [];

    const sessionName = getSessionName(session);
    const aiName = config().aiName;

    interactions.forEach((interaction) => {
      const time =
        interaction.createdAt.getHours() +
        ":" +
        interaction.createdAt.getMinutes() +
        ":" +
        interaction.createdAt.getSeconds();
      if (interaction.fulfillment.text) {
        interactionsText.push(`${aiName} (${time}): ${interaction.fulfillment.text}`);
      }
      if (interaction.input.text) {
        interactionsText.push(`${sessionName} (${time}): ${interaction.input.text}`);
      }
    });

    const prompt =
      `I have the following interactions between ${aiName} and a ${sessionName}, please reduce them to a single sentence I can use in future prompts. Include the date. Keep it below 200 characters.\n\n` +
      interactionsText.join("\n");

    const reducedMemory = await openai().textRequest(prompt, session, "system");
    console.debug("reducedMemory :>> ", reducedMemory);

    return reducedMemory;
  }

  async reduce(): Promise<void> {
    const interactions = await this.getInteractionsGroupedBySessionAndDay();
    console.info("Found " + Object.keys(interactions).length + " total interactions to reduce");

    for (const sessionId in interactions) {
      console.info(`Reducing interactions for session ${sessionId}`);

      const session = await Session.findById(sessionId);
      if (!session) {
        console.error(`\tSession ${sessionId} not found`);
        continue;
      }

      for (const day in interactions[sessionId]) {
        try {
          const dateFromDay = new Date(Number(day) * 1000 * 60 * 60 * 24);
          const _interactions = interactions[sessionId][day];
          console.info(`\tFound ${_interactions.length} interactions for day ${dateFromDay.toISOString()}`);

          const reducedInteractionText = await this.reduceInteractions(session, _interactions);

          const longTermMemory = await this.saveLongTermMemory(session, dateFromDay, reducedInteractionText);
          console.info(`\tSaved long term memory: ${longTermMemory.id}`);

          await this.markInteractionsAsReduced(longTermMemory, _interactions);
          console.info(`\tMarked ${_interactions.length} interactions as reduced`);
        } catch (err) {
          console.error(`\tError reducing interactions`, err);
        }
      }
    }
  }
}
