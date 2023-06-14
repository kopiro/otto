import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
  Configuration,
  CreateChatCompletionRequest,
  OpenAIApi,
} from "openai";
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
import { AIVectorMemory } from "./ai-vectormemory";
import { AIFunction } from "./ai-function";

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

  private async getSessionContext(session: Session | null): Promise<string> {
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
    const memory = AIVectorMemory.getInstance();
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

  async sendMessageToOpenAI(
    openAIMessages: ChatCompletionRequestMessage[],
    inputParams: InputParams,
    session: Session | null,
    text: string,
  ): Promise<Omit<Fulfillment, "analytics">> {
    const systemPrompt: string[] = [];

    // Add brain
    systemPrompt.push(await this.getPrompt());

    systemPrompt.push("# Context");
    systemPrompt.push(await this.getSessionContext(session));
    systemPrompt.push(await this.getMemoryContext(text));

    // Add interactions
    let interactions = await this.retrieveInteractions(session, text);

    // Build messages
    const messages: ChatCompletionRequestMessage[] = [
      {
        role: ChatCompletionRequestMessageRoleEnum.System,
        content: systemPrompt.join("\n"),
      },
      ...interactions,
      ...openAIMessages,
    ].filter(Boolean);

    console.debug("Messages:", messages);

    const completion = await openai().createChatCompletion({
      model: "gpt-3.5-turbo-0613",
      user: session?.id,
      n: 1,
      messages,
      functions: AIFunction.getInstance().getFunctionDefinitions(),
      function_call: "auto",
    });

    const answer = completion.data.choices.map((e) => e.message)[0];
    console.debug("Completion:", answer);

    if (answer.function_call) {
      const functionName = answer.function_call.name;
      const functionParams = JSON.parse(answer.function_call.arguments);
      const result = await AIFunction.getInstance().call(functionName, functionParams, inputParams, session);

      if (result.functionResult) {
        return this.sendMessageToOpenAI(
          [
            ...openAIMessages,
            {
              role: ChatCompletionRequestMessageRoleEnum.Function,
              name: functionName,
              content: result.functionResult,
            },
          ],
          inputParams,
          session,
          text,
        );
      }

      return result;
    }

    if (answer.content) {
      return { text: answer.content };
    }

    throw new Error("Invalid response: " + JSON.stringify(answer));
  }

  async getFulfillmentForInput(
    inputParams: InputParams,
    session: Session | null,
    role: ChatCompletionRequestMessageRoleEnum = "user",
  ): Promise<Fulfillment> {
    const { text } = inputParams;

    let sessionName = session ? this.getCleanSessionName(session) : undefined;
    const openAIMessages = [
      {
        role: role,
        content: text,
        name: sessionName,
      },
    ];

    try {
      const result = await this.sendMessageToOpenAI(openAIMessages, inputParams, session, text);
      return {
        ...result,
        analytics: {
          engine: "openai",
        },
        options: { translatePolicy: "never" },
      };
    } catch (error) {
      const errorMessage = error?.response?.data?.error?.message || error?.response?.data?.error || error?.message;
      console.error("error", errorMessage);
      return {
        error: {
          message: errorMessage,
          error: error,
        },
        analytics: { engine: "openai" },
      };
    }
  }
}
