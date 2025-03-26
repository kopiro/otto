import { Output, InputContext, Input, AIOutput, EmotionContext } from "../../types";
import config from "../../config";
import { Signale } from "signale";
import { logStacktrace, tryJsonParse } from "../../helpers";
import { OpenAISDK } from "../../lib/openai";
import { AIMemory, MemoryType } from "./ai-memory";
import { TIOChannel } from "../../data/io-channel";
import { TPerson } from "../../data/person";
import { isDocumentArray } from "@typegoose/typegoose";
import { ChatCompletionMessageParam } from "openai/resources";
import OpenAI from "openai";
import { DeepSeekSDK } from "../../lib/deepseek";

const TAG = "Brain";
const logger = new Signale({
  scope: TAG,
});

type Config = {
  emotionMaxIncrement: number;
  startEmotions: EmotionContext;
};

export class AIBrain {
  private openAISDK: OpenAI;
  private deepSeekSDK: OpenAI;

  constructor(private readonly config: Config) {
    this.openAISDK = OpenAISDK();
    this.deepSeekSDK = DeepSeekSDK();
  }

  private static instance: AIBrain;
  static getInstance(): AIBrain {
    if (!AIBrain.instance) {
      AIBrain.instance = new AIBrain(config().brain);
    }
    return AIBrain.instance;
  }

  private cleanNameForOpenAI(name: string): string {
    // Avoid Invalid 'messages[1].name': string does not match pattern. Expected a string that matches the pattern '^[a-zA-Z0-9_-]+$'.
    return name
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .substring(0, 64);
  }

  private async getRecentInteractionsWithIOChannelOrPerson(text: string, ioChannel: TIOChannel, person: TPerson) {
    const interactions = await AIMemory.getInstance().getRecentInteractions(ioChannel, person);

    return interactions
      .reverse()
      .map<ChatCompletionMessageParam | null>((interaction, i) => {
        // Remove last interaction because it's exactly like the input (text)
        if (i === interactions.length - 1) {
          if (
            interaction.input &&
            text === interaction.input.text &&
            // last minute
            interaction.createdAt > new Date(Date.now() - 1000 * 60)
          ) {
            return null;
          }
        }

        const description = interaction.getDescription();
        if (!description) return null;

        // If the assistant spoke
        if (interaction.output?.text) {
          return {
            role: "assistant",
            content: description,
          };
        }

        // If the user spoke
        if (interaction.input?.text) {
          return {
            role: interaction.input.role ?? "user",
            name: this.cleanNameForOpenAI(interaction.getSourceName()),
            content: description,
          };
        }

        return null;
      })
      .filter((e) => e !== null);
  }

  private getDocumentationJSONAIOutput(): Record<keyof AIOutput, string> {
    return {
      text: "The text you want to send",
      sentiment: "A number between 0 and 1, indicating how much the assistant is happy with the message",
      reaction: "An optional emoji reaction to the message. Use the subset available on Telegram.",
      channelName: "The name of the channel",
      emotionsUpdates: `A valid JSON object representing the increment/decrement in emotion map you're feeling towards this person. Maximum increment/decrement per emotion is ${this.config.emotionMaxIncrement}. Example: {"love":2,"trust":-3}`,
    };
  }

  private async getConversationInputAsText(ioChannel: TIOChannel, person: TPerson): Promise<string> {
    const prompts: string[] = [];

    prompts.push(`You are now chatting with "${person.getName()}" - "${ioChannel.getName()}".`);

    if (person.language) {
      const languageName = new Intl.DisplayNames(["en"], { type: "language" }).of(person.getLanguage());
      prompts.push(`You should speak in ${languageName}, unless otherwise specified.`);
    }

    prompts.push(
      `Towards ${person.getName()}, you are feeling this emotion map (modify your tone of voice accordingly): ${JSON.stringify(
        person.getEmotions(),
      )}`,
    );

    prompts.push(
      `STRICTLY reply in JSON using the following example: ${JSON.stringify(this.getDocumentationJSONAIOutput())}`,
    );

    return prompts.join("\n");
  }

  private async getContextAsText(context: InputContext = {}): Promise<string> {
    const prompt = [];

    // Append context
    for (const [key, value] of Object.entries(context)) {
      const humanKey = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
    const logName = `getMemoryContextAsText/${ioChannel.getName()}`;

    const aiMemory = AIMemory.getInstance();

    const convDescription = isDocumentArray(ioChannel.people)
      ? ioChannel.people.map((p) => p.getName()).join(", ")
      : person.getName();
    const contextAsString = Object.entries(context)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

    const vectors = await Promise.all([
      aiMemory.createVector(text),
      aiMemory.createVector(person.getName()),
      aiMemory.createVector(ioChannel.getName() + " " + convDescription),
      aiMemory.createVector(contextAsString),
    ]);

    const allMemories = await Promise.all([
      aiMemory.searchByVectors(
        vectors,
        MemoryType.declarative,
        aiMemory.conf.vectorial.declarative.limit,
        aiMemory.conf.vectorial.declarative.scoreThreshold,
      ),
      aiMemory.searchByVectors(
        vectors,
        MemoryType.episodic,
        aiMemory.conf.vectorial.episodic.limit,
        aiMemory.conf.vectorial.episodic.scoreThreshold,
      ),
      aiMemory.searchByVectors(
        vectors,
        MemoryType.social,
        aiMemory.conf.vectorial.social.limit,
        aiMemory.conf.vectorial.social.scoreThreshold,
      ),
    ]);

    const memories = allMemories.flat();

    logStacktrace(TAG, logName, {
      text,
      memories,
    });

    return memories
      .map((m) => m.payload?.text)
      .filter(Boolean)
      .join("\n");
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

  public async reduceText(debugIdentifier: string, text: string) {
    const logName = `reduceText/${debugIdentifier}`;

    const response = await this.deepSeekSDK.chat.completions.create({
      model: config().deepseek.textReducerModel,
      temperature: 0, // Make it predictable
      messages: [
        {
          role: "system",
          content: text,
        },
      ],
    });
    const content = response?.choices?.[0]?.message?.content;

    logStacktrace(TAG, logName, {
      text,
      content,
    });

    if (!content) {
      throw new Error("Unable to reduce text");
    }

    return content;
  }

  private async getPromptAsText(): Promise<string> {
    return await AIMemory.getInstance().getPrompt();
  }

  async completeChat(
    inputMessages: ChatCompletionMessageParam[],
    input: Input,
    ioChannel: TIOChannel,
    person: TPerson,
    inputText: string,
  ): Promise<Output> {
    const logName = `completeChat/${ioChannel.getName()}`;

    const context = {
      ...this.getDefaultContext(),
      ...input.context,
    };

    const [promptText, contextText, memoryContextText, conversationsInputText, recentInteractionsChatCompletions] =
      await Promise.all([
        this.getPromptAsText(),
        this.getContextAsText(context),
        this.getMemoryContextAsText(inputText, ioChannel, person, context),
        this.getConversationInputAsText(ioChannel, person),
        this.getRecentInteractionsWithIOChannelOrPerson(inputText, ioChannel, person),
      ]);

    // Build messages
    const messages = [
      {
        role: "system",
        content: promptText,
      },
      {
        role: "system",
        content: `CONTEXT:\n${contextText}`,
      },
      {
        role: "system",
        content: `MEMORIES:\n${memoryContextText}`,
      },
      ...recentInteractionsChatCompletions,
      {
        role: "system",
        content: conversationsInputText,
      },
      ...inputMessages,
    ].filter(Boolean);

    try {
      const completion = await this.deepSeekSDK.chat.completions.create({
        model: config().deepseek.conversationModel,
        temperature: config().deepseek.temperature,
        user: person.id,
        n: 1,
        messages: messages as ChatCompletionMessageParam[],
        response_format: { type: "json_object" },
      });

      const answerText = completion.choices.map((e) => e.message)?.[0];
      const answer = tryJsonParse<AIOutput | null>(answerText?.content ?? "", null);

      logStacktrace(TAG, logName, {
        messages,
        answer,
      });

      if (answer) {
        // Parse the answer
        delete answer.channelName;
        answer.sentiment = Number(answer.sentiment);

        return answer;
      }

      throw new Error("Invalid response: " + JSON.stringify(answerText));
    } catch (error) {
      logger.error("Failed to complete chat", error);
      logStacktrace(TAG, logName, {
        messages,
        error,
      });
      throw error;
    }
  }

  async getOutputForInput(input: Input, ioChannel: TIOChannel, person: TPerson): Promise<Output> {
    try {
      if ("text" in input) {
        const role = input.role || "user";

        const inputMessages: ChatCompletionMessageParam[] = [];

        if (input.replyToText) {
          // Prepend previous message from AI
          inputMessages.push({
            content: input.replyToText,
            role: "assistant",
          });
        }

        if (role === "user") {
          inputMessages.push({
            content: input.text,
            name: this.cleanNameForOpenAI(person.getName()),
            role: role,
          });
        } else {
          inputMessages.push({
            content: input.text,
            role: role,
          });
        }

        const output = await this.completeChat(inputMessages, input, ioChannel, person, input.text);
        return output;
      }

      throw new Error("Unable to process request");
    } catch (error) {
      logger.error("Failed to get output for input", error);
      throw error;
    }
  }
}
