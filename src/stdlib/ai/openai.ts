import { ChatCompletionRequestMessageRoleEnum, Configuration, CreateChatCompletionRequest, OpenAIApi } from "openai";
import {
  Fulfillment,
  CustomError,
  AIAction,
  InputParams,
  Session,
  Interaction as IInteraction,
  LongTermMemory as ILongTermMemory,
} from "../../types";
import config from "../../config";
import { Signale } from "signale";
import ai from ".";
import {
  getLanguageNameFromLanguageCode,
  getSessionLocaleTimeString,
  getSessionName,
  getSessionTranslateTo,
} from "../../helpers";
import { Interaction, LongTermMemory } from "../../data";
import fetch from "node-fetch";

type Config = {
  apiKey: string;
  model: string;
  brainUrl: string;
};

const TAG = "OpenAI";
const console = new Signale({
  scope: TAG,
});

const BRAIN_TTL_MIN = 10;

type MemoriesOperation = "none" | "only_interactions" | "only_memories" | "all";

class OpenAI {
  private api: OpenAIApi;
  private _brain: string;
  private _brainExpiration: number;

  constructor(private config: Config) {
    this.api = new OpenAIApi(new Configuration({ apiKey: this.config.apiKey }));
  }

  private async getBrain(session: Session): Promise<string> {
    if (!this._brainExpiration || this._brainExpiration < Math.floor(Date.now() / 1000)) {
      this._brain = await (await fetch(this.config.brainUrl)).text();
      this._brainExpiration = new Date(Date.now() + BRAIN_TTL_MIN * 60 * 1000).getTime() / 1000;
    }
    return this._brain;
  }

  async imageRequest(query: string, session: Session) {
    const sessionPath = ai().getDfSessionPath("SYSTEM");
    const [dfResponse] = await ai().dfSessionClient.detectIntent({
      session: sessionPath,
      queryInput: {
        event: {
          name: "OPENAI_IMAGE_BRAIN",
          languageCode: config().language,
        },
      },
    });
    const prompt = dfResponse.queryResult.fulfillmentText.replace("{query}", query);

    console.log("image prompt", prompt);

    const openaiResponse = await this.api.createImage({
      prompt,
      n: 1,
      size: "256x256",
      response_format: "url",
      user: session.id,
    });

    console.log("image completion :>> ", openaiResponse.data);
    return openaiResponse.data.data[0].url;
  }

  private async retrieveLongTermMemories(): Promise<CreateChatCompletionRequest["messages"]> {
    const memories = await LongTermMemory.find().sort({ createdAt: +1 });
    return memories.map((memory) => {
      return {
        role: ChatCompletionRequestMessageRoleEnum.System,
        content: `(${memory.forDate.toDateString()}) ${memory.text}`,
      };
    });
  }

  private async retrieveInteractions(
    session: Session,
    inputText: string,
  ): Promise<CreateChatCompletionRequest["messages"]> {
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
            content: interaction.input.text,
          };
        }
      })
      .filter(Boolean);
  }

  async textRequest(
    text: string,
    session: Session | null,
    role: "system" | "user" | "assistant" = "user",
    memoriesOp: MemoriesOperation = "all",
  ): Promise<string> {
    console.debug("text request :>> ", text);

    const brainPrompt = await this.getBrain(session);
    const brainMessage = {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: brainPrompt,
    };

    let systemMessage = null;
    if (role === "user") {
      const systemPrompt = `${config().aiName} is now chatting with ${getSessionName(
        session,
      )}, speaking ${await getLanguageNameFromLanguageCode(
        getSessionTranslateTo(session),
      )} to them. Current time is: ${getSessionLocaleTimeString(session)}`;

      systemMessage = {
        role: ChatCompletionRequestMessageRoleEnum.System,
        content: systemPrompt,
      };
    }

    const userMessage = {
      role: role,
      content: text,
    };

    let longTermMemories =
      memoriesOp === "only_memories" || memoriesOp === "all" ? await this.retrieveLongTermMemories() : [];
    let interactions =
      memoriesOp === "only_interactions" || memoriesOp === "all" ? await this.retrieveInteractions(session, text) : [];

    // Prepend system
    const messages = [brainMessage, systemMessage, ...longTermMemories, ...interactions, userMessage];
    console.debug("input :>> ", messages);

    try {
      const completion = await this.api.createChatCompletion({
        model: this.config.model,
        messages: messages,
      });
      const answerMessages = completion.data.choices.map((e) => e.message);
      const answerMessage = answerMessages[0];
      const answerText = answerMessage?.content;

      console.debug("completion :>> ", answerText);

      return answerText;
    } catch (error) {
      console.error("error :>> ", "toJSON" in error ? error.toJSON() : error);
      throw error;
    }
  }
}

let _instance: OpenAI;
export default (): OpenAI => {
  _instance = _instance || new OpenAI(config().openai);
  return _instance;
};
