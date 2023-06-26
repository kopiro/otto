import { ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum } from "openai";
import { Fulfillment, InputContext, InputParams } from "../../types";
import config from "../../config";
import { Signale } from "signale";
import { logStacktrace, tryJsonParse } from "../../helpers";
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

  private async getSessionContext(session: TSession | null, context?: InputContext): Promise<string> {
    const contextPrompt = [];

    contextPrompt.push("## User");
    contextPrompt.push(`Current time is: ${new Date().toLocaleTimeString()}`);

    // Append session related info
    if (session) {
      const languageName = new Intl.DisplayNames(["en"], { type: "language" }).of(session.getLanguage());
      contextPrompt.push(`
You are now chatting with ${session.getName()} - ${session.getDriverName()}.
Speak to them in ${languageName}, unless they speak a different language to you.
`);
    }

    // Append context
    for (const [key, value] of Object.entries(context)) {
      contextPrompt.push(`${key}: ${value}`);
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
  ): Promise<Fulfillment> {
    const systemPrompt: string[] = [];

    // Add brain
    systemPrompt.push(await this.getPrompt());

    systemPrompt.push("# Context");
    systemPrompt.push(await this.getSessionContext(session, inputParams.context));
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

    const request = {
      model: "gpt-3.5-turbo",
      user: session?.id,
      n: 1,
      messages,
      // functions: AIFunction.getInstance().getFunctionDefinitions(),
      // function_call: "auto",
    };

    logStacktrace("openai-request.json", request);

    const completion = await OpenAIApiSDK().createChatCompletion(request);

    logStacktrace("openai-completions.json", completion.data);

    const answer = completion.data.choices.map((e) => e.message)?.[0];

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

  async getFulfillmentForInput(params: InputParams, session: TSession | null): Promise<Fulfillment> {
    try {
      const sessionName = session ? this.getCleanSessionName(session) : undefined;

      if (params.text) {
        const result = await this.sendMessageToOpenAI(
          [
            {
              role: params.role || "user",
              content: params.text,
              name: sessionName,
            },
          ],
          params,
          session,
          params.text,
        );
        return result;
      }
    } catch (error) {
      logStacktrace("openai-error.json", error);

      const errorMessage = error?.response?.data?.error?.message || error?.message;
      throw new Error(errorMessage);
    }

    throw new Error("Unable to process request");
  }
}
