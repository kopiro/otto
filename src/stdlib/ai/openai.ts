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

  constructor(private conf: Config) {}

  private static instance: AIOpenAI;
  static getInstance(): AIOpenAI {
    if (!AIOpenAI.instance) {
      AIOpenAI.instance = new AIOpenAI(config().openai);
    }
    return AIOpenAI.instance;
  }

  private async getBrain(): Promise<string> {
    this._brain = this._brain || (await (await fetch(this.conf.brainUrl)).text());
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

  private async getPromptContext(session: Session) {
    const contextPrompt = [];

    // Append session related info
    if (session) {
      contextPrompt.push(
        [
          `You are now chatting with ${getSessionName(session)} - ${getSessionDriverName(session)}.`,
          `Speak ${await getLanguageNameFromLanguageCode(
            getSessionTranslateTo(session),
          )} to them, unless they speak a different language to you.`,
        ].join("\n"),
      );
    }
    contextPrompt.push(`Your time is: ${new Date().toLocaleTimeString()}`);

    console.debug("contextPrompt :>> ", contextPrompt);
    return contextPrompt;
  }

  async getFulfillmentForInput(
    params: InputParams,
    session: Session | null,
    role: "system" | "user" | "assistant" = "user",
    memoriesOp: MemoriesOperation = "all",
  ): Promise<Fulfillment> {
    const { text } = params;

    let sessionName = session ? this.getCleanSessionName(session) : undefined;

    const systemPrompt = [];

    // Add brain
    systemPrompt.push(await this.getBrain());

    // Add context
    systemPrompt.push(this.getPromptContext(session));

    // Add long term memories
    if (memoriesOp === "only_memories" || memoriesOp === "all") {
      let longTermMemories = await this.retrieveLongTermMemories();
      if (longTermMemories.length > 0) {
        systemPrompt.push("Recent interactions:\n" + longTermMemories);
      }
    }

    // Add interactions
    let interactions = [];
    if (memoriesOp === "only_interactions" || memoriesOp === "all") {
      interactions = await this.retrieveInteractions(session, text);
    }

    // Build messages
    const messages = [
      {
        role: ChatCompletionRequestMessageRoleEnum.System,
        content: systemPrompt.join("\n"),
      },
      ...interactions,
      {
        role: role,
        content: text,
        name: sessionName,
      },
    ].filter(Boolean);

    try {
      const completion = await openai().createChatCompletion({
        model: OPENAI_MODEL,
        user: session?.id,
        n: 1,
        messages: messages,
      });
      const answerMessages = completion.data.choices.map((e) => e.message);
      const answerMessage = answerMessages[0];
      const answerText = answerMessage?.content;

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
