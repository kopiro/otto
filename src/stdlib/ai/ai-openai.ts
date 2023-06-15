import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
  CreateChatCompletionRequest,
} from "openai";
import { Fulfillment, InputParams } from "../../types";
import config from "../../config";
import { Signale } from "signale";
import { ensureError, getLanguageNameFromLanguageCode, tryJsonParse } from "../../helpers";
import fetch from "node-fetch";
import { OpenAIApiSDK } from "../../lib/openai";
import { AIVectorMemory } from "./ai-vectormemory";
import { AIFunction } from "./ai-function";
import { Interaction } from "../../data/interaction";
import { TSession } from "../../data/session";

type Config = {
  apiKey: string;
  promptUrl: string;
};

const TAG = "OpenAI";
const logger = new Signale({
  scope: TAG,
});

export class AIOpenAI {
  private prompt!: string;

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

  private getCleanSessionName(session: TSession): string {
    return session
      .getName()
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .substring(0, 64);
  }

  private async retrieveInteractions(session: TSession, inputText: string): Promise<ChatCompletionRequestMessage[]> {
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
            inputText === interaction.input?.text &&
            // last minute
            interaction.createdAt > new Date(Date.now() - 1000 * 60)
          ) {
            return null;
          }
        }

        if (interaction.fulfillment?.text) {
          return {
            role: ChatCompletionRequestMessageRoleEnum.Assistant,
            content: interaction.fulfillment.text,
          };
        }
        if (interaction.input?.text) {
          return {
            role: ChatCompletionRequestMessageRoleEnum.User,
            name: sessionName,
            content: interaction.input.text,
          };
        }
      })
      .filter(Boolean) as ChatCompletionRequestMessage[];
  }

  private async getSessionContext(session: TSession | null): Promise<string> {
    const contextPrompt = [];

    contextPrompt.push("## User");

    contextPrompt.push(`Current time is: ${new Date().toLocaleTimeString()}`);

    // Append session related info
    if (session) {
      const userLanguage = await getLanguageNameFromLanguageCode(session.getLanguage());
      contextPrompt.push(`
You are now chatting with ${session.getName()} - ${session.getDriverName()}.
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
    session: TSession | null,
    text: string,
  ): Promise<Omit<Fulfillment, "analytics">> {
    const systemPrompt: string[] = [];

    // Add brain
    systemPrompt.push(await this.getPrompt());

    systemPrompt.push("# Context");
    systemPrompt.push(await this.getSessionContext(session));
    systemPrompt.push(await this.getMemoryContext(text));

    // Add interactions
    const interactions = session ? await this.retrieveInteractions(session, text) : [];

    // Build messages
    const messages: ChatCompletionRequestMessage[] = [
      {
        role: ChatCompletionRequestMessageRoleEnum.System,
        content: systemPrompt.join("\n"),
      },
      ...interactions,
      ...openAIMessages,
    ].filter(Boolean);

    logger.debug("Messages:", messages);

    const completion = await OpenAIApiSDK().createChatCompletion({
      model: "gpt-3.5-turbo-0613",
      user: session?.id,
      n: 1,
      messages,
      functions: AIFunction.getInstance().getFunctionDefinitions(),
      function_call: "auto",
    });

    const answer = completion.data.choices.map((e) => e.message)?.[0];
    logger.debug("Completion:", answer);

    if (answer?.function_call) {
      const functionName = answer.function_call.name;
      if (!functionName) {
        throw new Error("Invalid function name: " + JSON.stringify(answer));
      }

      const functionParams = tryJsonParse<any>(answer.function_call.arguments, {});

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

    if (answer?.content) {
      return { text: answer.content };
    }

    throw new Error("Invalid response: " + JSON.stringify(answer));
  }

  async getFulfillmentForInput(
    inputParams: InputParams,
    session: TSession | null,
    role: ChatCompletionRequestMessageRoleEnum = "user",
  ): Promise<Fulfillment> {
    if (!inputParams.text) {
      throw new Error("Missing inputParams.text");
    }

    const { text } = inputParams;

    const sessionName = session ? this.getCleanSessionName(session) : undefined;
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
    } catch (err) {
      const error = ensureError(err) as any;
      const errorMessage = error?.response?.data?.error?.message || error?.response?.data?.error || error?.message;

      return {
        error: {
          message: errorMessage,
        },
        analytics: { engine: "openai" },
      };
    }
  }
}
