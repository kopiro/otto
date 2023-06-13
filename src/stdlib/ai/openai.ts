import { ChatCompletionRequestMessageRoleEnum, Configuration, CreateChatCompletionRequest, OpenAIApi } from "openai";
import { Fulfillment, InputParams, Session } from "../../types";
import config from "../../config";
import { Signale } from "signale";
import {
  getLanguageNameFromLanguageCode,
  getSessionDriverName,
  getSessionName,
  getSessionTranslateTo,
} from "../../helpers";
import { Interaction } from "../../data";
import fetch from "node-fetch";
import openai from "../../lib/openai";
import { VectorMemory } from "./vectormemory";

type Config = {
  apiKey: string;
  promptUrl: string;
};

const TAG = "OpenAI";
const console = new Signale({
  scope: TAG,
});

export class AIOpenAI {
  private prompt: string;

  constructor(private conf: Config) {}

  private static instance: AIOpenAI;
  static getInstance(): AIOpenAI {
    if (!AIOpenAI.instance) {
      AIOpenAI.instance = new AIOpenAI(config().openai);
    }
    return AIOpenAI.instance;
  }

  private async getPrompt(): Promise<string> {
    this.prompt = this.prompt || (await (await fetch(this.conf.promptUrl)).text());
    return this.prompt;
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
          reducedAt: { $exists: false },
          createdAt: { $gte: new Date(Date.now() - 20 * 60_000) },
        },
        {
          "input.text": { $ne: null },
          session: session.id,
          reducedAt: { $exists: false },
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

  private async getSessionContext(session: Session): Promise<string> {
    const contextPrompt = [];

    contextPrompt.push("## User");

    contextPrompt.push(`Current time is: ${new Date().toLocaleTimeString()}`);

    // Append session related info
    if (session) {
      const userLanguage = await getLanguageNameFromLanguageCode(getSessionTranslateTo(session));
      contextPrompt.push(`
You are now chatting with ${getSessionName(session)} - ${getSessionDriverName(session)}.
Speak ${userLanguage} to them, unless they speak a different language to you.
`);
    }

    return contextPrompt.join("\n");
  }

  private async getMemoryContext(text: string): Promise<string> {
    const memory = VectorMemory.getInstance();
    const vector = await memory.createEmbedding(text);

    const [declarativeMemories, episodicMemories] = await Promise.all([
      memory.searchByVector(vector, "declarative"),
      memory.searchByVector(vector, "episodic"),
    ]);

    return `
## Memories:\n${declarativeMemories.join("\n")}
## Episodes:\n${episodicMemories.join("\n")}
`;
  }

  async getFulfillmentForInput(
    params: InputParams,
    session: Session | null,
    role: "system" | "user" | "assistant" = "user",
  ): Promise<Fulfillment> {
    const { text } = params;

    let sessionName = session ? this.getCleanSessionName(session) : undefined;

    const systemPrompt: string[] = [];

    // Add brain
    systemPrompt.push(await this.getPrompt());

    systemPrompt.push("# Context");
    systemPrompt.push(await this.getSessionContext(session));
    systemPrompt.push(await this.getMemoryContext(text));

    // Add interactions
    let interactions = await this.retrieveInteractions(session, text);

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

    console.debug("Messages:", messages);

    try {
      const completion = await openai().createChatCompletion({
        model: "gpt-3.5-turbo",
        user: session?.id,
        messages: messages,
      });
      const answerMessages = completion.data.choices.map((e) => e.message);
      const answerText = answerMessages[0]?.content;

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
