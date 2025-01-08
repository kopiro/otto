import { Fulfillment, InputContext, Input } from "../../types";
import config from "../../config";
import { Signale } from "signale";
import { logStacktrace, tryJsonParse } from "../../helpers";
import { OpenAIApiSDK } from "../../lib/openai";
import { AIVectorMemory, MemoryType } from "./ai-vectormemory";
import { AIFunction } from "./ai-function";
import { Interaction } from "../../data/interaction";
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
  interactionLimit: number;
  vectorMemory: {
    declarative: {
      limit: number;
      scoreThreshold: number;
    };
    episodic: {
      limit: number;
      scoreThreshold: number;
    };
    social: {
      limit: number;
      scoreThreshold: number;
    };
  };
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

  public async getHeaderPromptAsText(refresh = false): Promise<string> {
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
    // Avoid Invalid 'messages[1].name': string does not match pattern. Expected a string that matches the pattern '^[a-zA-Z0-9_-]+$'.
    return name
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .substring(0, 64);
  }

  private async getRecentInteractionsAsChatCompletions(
    text: string,
    ioChannel: TIOChannel,
    person: TPerson,
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
        {
          "fulfillment.text": { $ne: null },
          person: person.id,
          reducedTo: { $exists: false },
        },
        {
          "input.text": { $ne: null },
          person: person.id,
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
      .limit(this.conf.interactionLimit);

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

        // If the assistant spoke
        if (interaction.fulfillment && "text" in interaction.fulfillment) {
          return {
            role: "assistant",
            content: interaction.fulfillment.text,
          };
        }

        // If the user spoke
        if (interaction.input && "text" in interaction.input) {
          return {
            role: interaction.input.role ?? "user",
            name: this.cleanName(interaction.getSourceName()),
            content: interaction.input.text,
          };
        }

        return null;
      })
      .filter<ChatCompletionMessageParam>((e): e is ChatCompletionMessageParam => e !== null);
  }

  private async getPersonContextAsText(ioChannel: TIOChannel, person: TPerson): Promise<string> {
    const prompt = [];

    prompt.push("## Context\n");
    prompt.push(`You are chatting with ${person.name} - ${ioChannel.getDriverName()}.`);

    const languageName = new Intl.DisplayNames(["en"], { type: "language" }).of(person.language);
    prompt.push(`You should reply in ${languageName}.`);

    return prompt.join("\n");
  }

  private async getContextAsText(context: InputContext = {}): Promise<string> {
    const prompt = [];

    prompt.push(`## Input Context\n`);

    // Append context
    for (const [key, value] of Object.entries(context)) {
      const humanKey = key.replace(/_/g, " ");
      prompt.push(`${humanKey}: ${value}`);
    }

    return prompt.join("\n");
  }

  private async getMemoryContextAsText(
    text: string,
    ioChannel: TIOChannel,
    person: TPerson,
    context: InputContext,
  ): Promise<string> {
    const AIVectorMemoryInstance = AIVectorMemory.getInstance();

    const convDescription = isDocumentArray(ioChannel.people)
      ? ioChannel.people.map((p) => p.name).join(", ")
      : person.name;
    const contextAsString = Object.entries(context)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

    const vectors = await Promise.all([
      AIVectorMemoryInstance.createVector(text),
      AIVectorMemoryInstance.createVector(ioChannel.getDriverName() + " " + convDescription),
      AIVectorMemoryInstance.createVector(contextAsString),
    ]);

    const memories = await Promise.all([
      AIVectorMemoryInstance.searchByVectors(
        vectors,
        MemoryType.declarative,
        this.conf.vectorMemory.declarative.limit,
        this.conf.vectorMemory.declarative.scoreThreshold,
      ),
      AIVectorMemoryInstance.searchByVectors(
        vectors,
        MemoryType.episodic,
        this.conf.vectorMemory.episodic.limit,
        this.conf.vectorMemory.episodic.scoreThreshold,
      ),
      AIVectorMemoryInstance.searchByVectors(
        vectors,
        MemoryType.social,
        this.conf.vectorMemory.social.limit,
        this.conf.vectorMemory.social.scoreThreshold,
      ),
    ]);

    // logger.debug("Retrieved memories", memoriesUnique);

    return `## Memory\n\n` + memories.flat().join("\n");
  }

  getDefaultContext(): Record<string, string> {
    const current_day = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const current_time = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      timeZoneName: "short",
    });
    return {
      current_day,
      current_time,
    };
  }

  async requestToOpenAI(
    messagesChatCompletions: ChatCompletionMessageParam[],
    input: Input,
    ioChannel: TIOChannel,
    person: TPerson,
    text: string,
    role: "user" | "assistant" | "system",
  ): Promise<Fulfillment> {
    const prompt: string[] = [];

    const context = {
      ...this.getDefaultContext(),
      ...input.context,
    };

    const [
      recentInteractionsChatCompletions,
      headerPromptText,
      contextText,
      personOrSystemContextText,
      memoryContextText,
    ] = await Promise.all([
      this.getRecentInteractionsAsChatCompletions(text, ioChannel, person),
      this.getHeaderPromptAsText(),
      this.getContextAsText(context),
      this.getPersonContextAsText(ioChannel, person),
      this.getMemoryContextAsText(text, ioChannel, person, context),
    ]);

    prompt.push(headerPromptText);
    prompt.push(contextText);
    prompt.push(personOrSystemContextText);
    prompt.push(memoryContextText);

    const promptChatCompletion: ChatCompletionSystemMessageParam = {
      role: "system",
      content: prompt.join("\n\n"),
    };

    // Build messages
    const messages: ChatCompletionMessageParam[] = [
      promptChatCompletion,
      ...recentInteractionsChatCompletions,
      ...messagesChatCompletions,
    ].filter(Boolean);

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

    // TODO: remove
    if (answer?.function_call) {
      const functionName = answer.function_call.name;
      if (!functionName) {
        throw new Error("Invalid function name: " + JSON.stringify(answer));
      }

      const functionParams = tryJsonParse<any>(answer.function_call.arguments, {});

      const result = await AIFunction.getInstance().call(functionName, functionParams, input, ioChannel, person);

      if (result.functionResult) {
        return this.requestToOpenAI(
          [
            ...messagesChatCompletions,
            {
              role: "function",
              name: functionName,
              content: result.functionResult,
            },
          ],
          input,
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

  async getFulfillmentForInput(input: Input, ioChannel: TIOChannel, person: TPerson): Promise<Fulfillment> {
    try {
      if ("text" in input) {
        const role = input.role || "user";
        const result = await this.requestToOpenAI(
          [
            role === "user"
              ? {
                  content: input.text,
                  name: this.cleanName(person.name),
                  role: role,
                }
              : {
                  content: input.text,
                  role: role,
                },
          ],
          input,
          ioChannel,
          person,
          input.text,
          role,
        );
        return result;
      }
    } catch (error) {
      logger.error("Failed to get fulfillment for input", error);
      logStacktrace("openai-error.json", error);
      const errorMessage = error instanceof OpenAI.APIError ? `OpenAI: ${error.error.message}` : String(error);
      throw new Error(errorMessage);
    }

    throw new Error("Unable to process request");
  }
}
