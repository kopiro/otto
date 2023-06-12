import { ChatCompletionRequestMessageRoleEnum, Configuration, CreateChatCompletionRequest, OpenAIApi } from "openai";
import { Fulfillment, InputParams, Session } from "../../types";
import config from "../../config";
import { Signale } from "signale";
import {
  getLanguageNameFromLanguageCode,
  getSessionDriverName,
  getSessionLocaleTimeString,
  getSessionName,
  getSessionTranslateTo,
} from "../../helpers";
import { Interaction, LongTermMemory } from "../../data";
import fetch from "node-fetch";
import openai from "../../lib/openai";

type Config = {
  apiKey: string;
  brainUrl: string;
};

const TAG = "OpenAI";
const console = new Signale({
  scope: TAG,
});

const OPENAI_MODEL = "gpt-3.5-turbo";
const BRAIN_TTL_MIN = 10;

type MemoriesOperation = "none" | "only_interactions" | "only_memories" | "all";

export class AIOpenAI {
  private _brain: string;
  private _brainExpiration: number;

  constructor(private conf: Config) {}

  private static instance: AIOpenAI;
  static getInstance(): AIOpenAI {
    if (!AIOpenAI.instance) {
      AIOpenAI.instance = new AIOpenAI(config().openai);
    }
    return AIOpenAI.instance;
  }

  private async getBrain(session: Session): Promise<string> {
    if (!this._brainExpiration || this._brainExpiration < Math.floor(Date.now() / 1000)) {
      this._brain = await (await fetch(this.conf.brainUrl)).text();
      this._brainExpiration = new Date(Date.now() + BRAIN_TTL_MIN * 60 * 1000).getTime() / 1000;
    }
    return this._brain;
  }

  private async retrieveLongTermMemories(): Promise<string> {
    const memories = await LongTermMemory.find().sort({ createdAt: +1 });
    return memories.map((memory) => `(${memory.forDate.toDateString()}) ${memory.text}`).join("\n");
  }

  private getCleanSessionName(session: Session): string {
    return getSessionName(session)
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .substring(0, 64);
  }

  private async retrieveInteractions(
    session: Session,
    inputText: string,
  ): Promise<CreateChatCompletionRequest["messages"]> {
    const sessionName = this.getCleanSessionName(session);

    // Get all Interaction where we have a input.text or fulfillment.text in the last 20m
    const interactions = await Interaction.find({
      $or: [
        {
          "fulfillment.text": { $ne: null },
          session: session.id,
          reducedLongTermMemory: { $exists: false },
          createdAt: { $gte: new Date(Date.now() - 20 * 60_000) },
        },
        {
          "input.text": { $ne: null },
          session: session.id,
          reducedLongTermMemory: { $exists: false },
          createdAt: { $gte: new Date(Date.now() - 20 * 60_000) },
        },
      ],
    }).sort({ createdAt: +1 });

    return interactions
      .map((interaction, i) => {
        if (i === interactions.length - 1) {
          if (
            inputText === interaction.input.text &&
            // last minute
            interaction.createdAt > new Date(Date.now() - 1000 * 60)
          ) {
            return null;
          }
        }

        if (interaction.fulfillment.text) {
          return {
            role: ChatCompletionRequestMessageRoleEnum.Assistant,
            content: interaction.fulfillment.text,
          };
        }
        if (interaction.input.text) {
          return {
            role: ChatCompletionRequestMessageRoleEnum.User,
            name: sessionName,
            content: interaction.input.text,
          };
        }
      })
      .filter(Boolean);
  }

  async getFulfillmentForInput(
    params: InputParams,
    session: Session | null,
    role: "system" | "user" | "assistant" = "user",
    memoriesOp: MemoriesOperation = "all",
  ): Promise<Fulfillment> {
    const { text } = params;

    let sessionName = undefined;

    const systemPrompt = [];

    const brain = await this.getBrain(session);
    systemPrompt.push(brain);

    // Append session related info
    if (session) {
      sessionName = this.getCleanSessionName(session);
      systemPrompt.push(
        [
          `You are now chatting with ${getSessionName(session)} - ${getSessionDriverName(session)}.`,
          `Speak ${await getLanguageNameFromLanguageCode(
            getSessionTranslateTo(session),
          )} to them, unless they speak a different language to you.`,
        ].join("\n"),
      );
    }

    systemPrompt.push(`Your time is: ${new Date().toLocaleTimeString()}`);

    let longTermMemories =
      memoriesOp === "only_memories" || memoriesOp === "all" ? await this.retrieveLongTermMemories() : "";
    if (longTermMemories.length > 0) {
      systemPrompt.push("Recent interactions:\n" + longTermMemories);
    }

    let interactions =
      memoriesOp === "only_interactions" || memoriesOp === "all" ? await this.retrieveInteractions(session, text) : [];

    const systemText = systemPrompt.join("\n\n----\n");

    const messages = [
      ...interactions,
      {
        role: role,
        content: text,
        name: sessionName,
      },
    ].filter(Boolean);

    console.debug("System text :>>", systemText);
    console.debug("Messages :>> ", messages);

    messages.unshift({
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: systemText,
    });

    try {
      const completion = await openai().createChatCompletion({
        model: OPENAI_MODEL,
        temperature: 0.9,
        user: session?.id,
        n: 1,
        messages: messages,
      });
      const answerMessages = completion.data.choices.map((e) => e.message);
      const answerMessage = answerMessages[0];
      const answerText = answerMessage?.content;

      console.debug("completion :>> ", answerText);

      return { text: answerText, analytics: { engine: "openai" }, options: { translatePolicy: "never" } };
    } catch (error) {
      console.error("error", error?.response?.data);
      return {
        error: {
          message: error?.response?.data?.error?.message || error?.response?.data?.error || error?.message,
        },
        analytics: { engine: "openai" },
      };
    }
  }
}
