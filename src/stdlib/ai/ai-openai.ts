import { ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum } from "openai";
import { Fulfillment, InputContext, InputParams } from "../../types";
import config from "../../config";
import { Signale } from "signale";
import { logStacktrace, tryJsonParse } from "../../helpers";
import fetch from "node-fetch";
import { OpenAIApiSDK } from "../../lib/openai";
import { AIVectorMemory, MemoryType } from "./ai-vectormemory";
import { AIFunction } from "./ai-function";
import { Interaction, TInteraction } from "../../data/interaction";
import { TIOChannel } from "../../data/io-channel";
import { TPerson } from "../../data/person";
import { isDocument, isDocumentArray } from "@typegoose/typegoose";

type Config = {
  apiKey: string;
  promptUrl: string;
};

const TAG = "OpenAI";
const logger = new Signale({
  scope: TAG,
});

const INTERACTION_LIMIT = 20;

const DECLARATIVE_MEMORY_LIMIT = 10;
const EPISODIC_MEMORY_LIMIT = 5;
const SOCIAL_MEMORY_LIMIT = 2;

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

  public async buildPrompt(refresh = false): Promise<string> {
    if (!this.prompt || refresh) {
      const prompt = await (await fetch(this.conf.promptUrl)).text();
      if (prompt) {
        this.prompt = prompt;
      } else {
        logger.error("Failed to retrieve prompt");
      }
    }
    return this.prompt;
  }

  private cleanName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 64);
  }

  private async retrieveRecentInteractionsAsOpenAIMessages(
    text: string,
    ioChannel: TIOChannel,
  ): Promise<ChatCompletionRequestMessage[]> {
    // Get all Interaction where we have a input.text or fulfillment.text in the last 20m
    const interactions = await Interaction.find({
      $or: [
        {
          "fulfillment.text": { $ne: null },
          ioChannel: ioChannel.id,
          reducedTo: { $exists: false },
        },
        {
          "input.text": { $ne: null },
          ioChannel: ioChannel.id,
          reducedTo: { $exists: false },
        },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(INTERACTION_LIMIT);

    return interactions
      .reverse()
      .map<ChatCompletionRequestMessage | null>((interaction, i) => {
        // Remove last interaction because it's exactly like the input (text)
        if (i === interactions.length - 1) {
          if (
            text === interaction.input?.text &&
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

        return null;
      })
      .filter<ChatCompletionRequestMessage>((e): e is ChatCompletionRequestMessage => e !== null);
  }

  private async getPersonOrSystemContext(
    ioChannel: TIOChannel,
    person: TPerson,
    role: ChatCompletionRequestMessageRoleEnum,
  ): Promise<string> {
    const prompt = [];

    // Append ioChannel related info
    if (role === ChatCompletionRequestMessageRoleEnum.User) {
      prompt.push("## User Context\n");
      prompt.push(`You are chatting with ${person.name} - ${ioChannel.getDriverName()}.`);
      const languageName = new Intl.DisplayNames(["en"], { type: "language" }).of(person.language);
      prompt.push(`You should reply in ${languageName}.`);
    } else {
      prompt.push("## System Context\n");
      prompt.push(`You are chatting ${ioChannel.getDriverName()}.`);
    }

    return prompt.join("\n");
  }

  private async getInputContext(context: InputContext = {}): Promise<string> {
    const prompt = [];

    prompt.push(`## Input Context\n`);

    context.current_datetime_utc = context.current_datetime_utc || new Date().toISOString();

    // Append context
    for (const [key, value] of Object.entries(context)) {
      const humanKey = key.replace(/_/g, " ");
      prompt.push(`${humanKey}: ${value}`);
    }

    return prompt.join("\n");
  }

  private async getVectorialMemory(text: string, ioChannel: TIOChannel, person: TPerson): Promise<string> {
    const AIVectorMemoryInstance = AIVectorMemory.getInstance();

    await ioChannel.populate("people");
    const convDescription = isDocumentArray(ioChannel.people)
      ? ioChannel.people.map((p) => p.name).join(", ")
      : person.name;

    const [vectorOfText, vectorOfConversation] = await Promise.all([
      AIVectorMemoryInstance.createVector(text),
      AIVectorMemoryInstance.createVector(ioChannel.getDriverName() + " " + convDescription),
    ]);

    // Move this to batch
    const memories = await Promise.all([
      AIVectorMemoryInstance.searchByVector(vectorOfText, MemoryType.declarative, DECLARATIVE_MEMORY_LIMIT),
      AIVectorMemoryInstance.searchByVector(vectorOfText, MemoryType.episodic, EPISODIC_MEMORY_LIMIT),
      AIVectorMemoryInstance.searchByVector(vectorOfText, MemoryType.social, SOCIAL_MEMORY_LIMIT),
      AIVectorMemoryInstance.searchByVector(vectorOfConversation, MemoryType.declarative, DECLARATIVE_MEMORY_LIMIT),
      AIVectorMemoryInstance.searchByVector(vectorOfConversation, MemoryType.episodic, EPISODIC_MEMORY_LIMIT),
      AIVectorMemoryInstance.searchByVector(vectorOfConversation, MemoryType.social, SOCIAL_MEMORY_LIMIT),
    ]);

    // Remove duplicates
    const memoriesUnique = [...new Set(memories.flat())];

    logger.debug("Memory", memoriesUnique);

    return `## Memory\n\n` + memoriesUnique.join("\n");
  }

  private interactionsAsString(interactions: TInteraction[]): string {
    return interactions
      .map((interaction) => {
        if (interaction.input?.text) {
          return `${interaction.getSourceName()}: ${interaction.input.text}`;
        }
        if (interaction.fulfillment?.text) {
          return `${config().aiName}: ${interaction.fulfillment.text}`;
        }
      })
      .filter((e) => e !== undefined)
      .join("\n");
  }

  async requestToOpenAI(
    openAIMessages: ChatCompletionRequestMessage[],
    inputParams: InputParams,
    ioChannel: TIOChannel,
    person: TPerson,
    text: string,
    role: ChatCompletionRequestMessageRoleEnum,
  ): Promise<Fulfillment> {
    const systemPrompt: string[] = [];

    const [interactions, prompt, genericContext, personContext, memoryContext] = await Promise.all([
      this.retrieveRecentInteractionsAsOpenAIMessages(text, ioChannel),
      this.buildPrompt(),
      this.getInputContext(inputParams.context),
      this.getPersonOrSystemContext(ioChannel, person, role),
      this.getVectorialMemory(text, ioChannel, person),
    ]);

    systemPrompt.push(prompt);
    systemPrompt.push(genericContext);
    systemPrompt.push(personContext);
    systemPrompt.push(memoryContext);

    // Build messages
    const messages: ChatCompletionRequestMessage[] = [
      {
        role: ChatCompletionRequestMessageRoleEnum.System,
        content: systemPrompt.join("\n\n"),
      },
      ...interactions,
      ...openAIMessages,
    ].filter(Boolean);

    const request = {
      model: "gpt-3.5-turbo",
      user: person.id,
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
        return this.requestToOpenAI(
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
          role,
        );
      }

      return result;
    }

    if (answer?.content) {
      return { text: answer.content };
    }

    throw new Error("Invalid response: " + JSON.stringify(answer));
  }

  async getFulfillmentForInput(params: InputParams, ioChannel: TIOChannel, person: TPerson): Promise<Fulfillment> {
    try {
      if (params.text) {
        const role = params.role || ChatCompletionRequestMessageRoleEnum.User;
        const result = await this.requestToOpenAI(
          [
            role === ChatCompletionRequestMessageRoleEnum.User
              ? {
                  content: params.text,
                  name: this.cleanName(person.name),
                  role: role,
                }
              : {
                  content: params.text,
                  role: role,
                },
          ],
          params,
          ioChannel,
          person,
          params.text,
          role,
        );
        return result;
      }
    } catch (error) {
      logStacktrace("openai-error.json", error);

      const errorMessage = (error as any)?.response?.data?.error?.message || (error as Error)?.message;
      throw new Error(errorMessage);
    }

    throw new Error("Unable to process request");
  }
}
