import { ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum } from "openai";
import { Fulfillment, InputContext, InputParams } from "../../types";
import config from "../../config";
import { Signale } from "signale";
import { logStacktrace, tryJsonParse } from "../../helpers";
import fetch from "node-fetch";
import { OpenAIApiSDK } from "../../lib/openai";
import { AIVectorMemory, MemoryType } from "./ai-vectormemory";
import { AIFunction } from "./ai-function";
import { Interaction } from "../../data/interaction";
import { TIOChannel } from "../../data/io-channel";
import { TPerson } from "../../data/person";

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

  private cleanName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 64);
  }

  private async retrieveRecentInteractions(
    ioChannel: TIOChannel,
    inputText: string,
  ): Promise<ChatCompletionRequestMessage[]> {
    // Get all Interaction where we have a input.text or fulfillment.text in the last 20m
    const interactions = await Interaction.find({
      $or: [
        {
          "fulfillment.text": { $ne: null },
          ioChannel: ioChannel.id,
          reducedTo: { $exists: false },
          createdAt: { $gte: new Date(Date.now() - 20 * 60_000) },
        },
        {
          "input.text": { $ne: null },
          ioChannel: ioChannel.id,
          reducedTo: { $exists: false },
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
            role: interaction.input.role || ChatCompletionRequestMessageRoleEnum.User,
            name: this.cleanName(interaction.getSourceName()),
            content: interaction.input.text,
          };
        }
      })
      .filter(Boolean) as ChatCompletionRequestMessage[];
  }

  private async getPersonContext(ioChannel: TIOChannel, person: TPerson | null): Promise<string> {
    const prompt = [];

    // Append ioChannel related info
    if (person) {
      prompt.push("## User Context");

      prompt.push(`You are chatting with ${person.name} - ${ioChannel.getDriverName()}.`);

      const languageName = new Intl.DisplayNames(["en"], { type: "language" }).of(person.language);
      prompt.push(`You must reply in ${languageName}.`);
    } else {
      prompt.push(`You are chatting ${ioChannel.getDriverName()}.`);
    }

    return prompt.join("\n");
  }

  private async getGenericContext(context: InputContext = {}): Promise<string> {
    const prompt = [];

    prompt.push(`## Generic Context`);

    context.current_datetime_utc = context.current_datetime_utc || new Date().toISOString();

    // Append context
    for (const [key, value] of Object.entries(context)) {
      const humanKey = key.replace(/_/g, " ");
      prompt.push(`${humanKey}: ${value}`);
    }

    return prompt.join("\n");
  }

  private async getMemoryContext(text: string): Promise<string> {
    const prompt = [];

    const memory = AIVectorMemory.getInstance();
    const vector = await memory.createEmbedding(text);

    const [declarativeMemories, episodicMemories] = await Promise.all([
      memory.searchByVector(vector, MemoryType.declarative),
      memory.searchByVector(vector, MemoryType.episodic),
    ]);

    prompt.push(`## Memory Context: \n${declarativeMemories.join("\n")}`);

    prompt.push(`## Episode Context: \n${episodicMemories.join("\n")}`);

    return prompt.join("\n");
  }

  async sendMessageToOpenAI(
    openAIMessages: ChatCompletionRequestMessage[],
    inputParams: InputParams,
    ioChannel: TIOChannel,
    person: TPerson | null,
    text: string,
  ): Promise<Fulfillment> {
    const systemPrompt: string[] = [];

    const [prompt, genericContext, personContext, memoryContext, interactions] = await Promise.all([
      this.getPrompt(),
      this.getGenericContext(inputParams.context),
      this.getPersonContext(ioChannel, person),
      this.getMemoryContext(text),
      this.retrieveRecentInteractions(ioChannel, text),
    ]);

    systemPrompt.push(prompt);
    systemPrompt.push(genericContext);
    systemPrompt.push(personContext);
    systemPrompt.push(memoryContext);

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
      user: ioChannel?.id,
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

      const result = await AIFunction.getInstance().call(functionName, functionParams, inputParams, ioChannel, person);

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
          ioChannel,
          person,
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
    params: InputParams,
    ioChannel: TIOChannel,
    person: TPerson | null,
  ): Promise<Fulfillment> {
    try {
      if (params.text) {
        const result = await this.sendMessageToOpenAI(
          [
            {
              role: params.role || ChatCompletionRequestMessageRoleEnum.User,
              content: params.text,
              name: person ? this.cleanName(person.name) : undefined,
            },
          ],
          params,
          ioChannel,
          person,
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
