import { Fulfillment, InputContext, InputParams } from "../../types";
import config from "../../config";
import { Signale } from "signale";
import { logStacktrace, tryJsonParse } from "../../helpers";
import { OpenAIApiSDK } from "../../lib/openai";
import { AIVectorMemory, MemoryType } from "./ai-vectormemory";
import { AIFunction } from "./ai-function";
import { Interaction, TInteraction } from "../../data/interaction";
import { TIOChannel } from "../../data/io-channel";
import { TPerson } from "../../data/person";
import { isDocumentArray } from "@typegoose/typegoose";
import { ChatCompletionMessageParam, ChatCompletionSystemMessageParam } from "openai/resources";
import OpenAI from "openai";
import fetch from "node-fetch";

type Config = {
  apiKey: string;
  promptUrl: string;
  conversationModel: string;
  textReducerModel: string;
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
  ): Promise<ChatCompletionMessageParam[]> {
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
      // In the last hour
      .where({
        createdAt: {
          $gt: new Date(Date.now() - 1000 * 60 * 60),
        },
      })
      .limit(INTERACTION_LIMIT);

    return interactions
      .reverse()
      .map<ChatCompletionMessageParam | null>((interaction, i) => {
        // Remove last interaction because it's exactly like the input (text)
        if (i === interactions.length - 1) {
          if (
            interaction.input &&
            "text" in interaction.input &&
            text === interaction.input.text &&
            // last minute
            interaction.createdAt > new Date(Date.now() - 1000 * 60)
          ) {
            return null;
          }
        }

        if (interaction.fulfillment?.text) {
          return {
            role: "assistant",
            content: interaction.fulfillment.text,
          };
        }

        if (interaction.input && "text" in interaction.input) {
          return {
            role: interaction.input.role || "user",
            name: this.cleanName(interaction.getSourceName()),
            content: interaction.input.text,
          };
        }

        return null;
      })
      .filter<ChatCompletionMessageParam>((e): e is ChatCompletionMessageParam => e !== null);
  }

  private async getPersonOrSystemContext(
    ioChannel: TIOChannel,
    person: TPerson,
    role: "user" | "assistant" | "system",
  ): Promise<string> {
    const prompt = [];

    // Append ioChannel related info
    if (role === "user") {
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

  private async getMemoryContext(text: string, ioChannel: TIOChannel, person: TPerson): Promise<string> {
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

    // logger.debug("Memory", memoriesUnique);

    return `## Memory\n\n` + memoriesUnique.join("\n");
  }

  private interactionsAsString(interactions: TInteraction[]): string {
    return interactions
      .map((interaction) => {
        if (interaction.input && "text" in interaction.input) {
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
    openAIMessages: ChatCompletionMessageParam[],
    inputParams: InputParams,
    ioChannel: TIOChannel,
    person: TPerson,
    text: string,
    role: "user" | "assistant" | "system",
  ): Promise<Fulfillment> {
    const systemPrompt: string[] = [];

    const [interactions, prompt, genericContext, personContext, memoryContext] = await Promise.all([
      this.retrieveRecentInteractionsAsOpenAIMessages(text, ioChannel),
      this.buildPrompt(),
      this.getInputContext(inputParams.context),
      this.getPersonOrSystemContext(ioChannel, person, role),
      this.getMemoryContext(text, ioChannel, person),
    ]);

    systemPrompt.push(prompt);
    systemPrompt.push(genericContext);
    systemPrompt.push(personContext);
    systemPrompt.push(memoryContext);

    const systemMessage: ChatCompletionSystemMessageParam = {
      role: "system",
      content: systemPrompt.join("\n\n"),
    };

    // Build messages
    const messages: ChatCompletionMessageParam[] = [systemMessage, ...interactions, ...openAIMessages].filter(Boolean);

    logStacktrace("openai-messages.json", messages);

    const completion = await OpenAIApiSDK().chat.completions.create({
      model: this.conf.conversationModel,

      user: person.id,
      n: 1,
      messages,
      // functions: AIFunction.getInstance().getFunctionDefinitions(),
      // function_call: "auto",
    });

    logStacktrace("openai-completions.json", completion);

    const answer = completion.choices.map((e) => e.message)?.[0];

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
              role: "function",
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
      if ("text" in params) {
        const role = params.role || "user";
        const result = await this.requestToOpenAI(
          [
            role === "user"
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
      const errorMessage = error instanceof OpenAI.APIError ? error?.name : String(error);
      throw new Error(errorMessage);
    }

    throw new Error("Unable to process request");
  }
}
