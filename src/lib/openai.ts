import { ChatCompletionRequestMessageRoleEnum, Configuration, OpenAIApi } from "openai";
import { Fulfillment, CustomError, AIAction, InputParams, Session } from "../types";
import config from "../config";
import { Signale } from "signale";
import ai from "../stdlib/ai";
import {
  getLanguageNameFromLanguageCode,
  getSessionLocaleTimeString,
  getSessionName,
  getSessionTranslateTo,
} from "../helpers";
import { Interaction } from "../data";

type Config = {
  apiKey: string;
  interactionTTLMinutes: number;
  model: string;
};

const TAG = "OpenAI";
const console = new Signale({
  scope: TAG,
});

const BRAIN_TTL_MIN = 10;

class OpenAI {
  private api: OpenAIApi;
  private _brain: string;
  private _brainExpiration: number;

  constructor(private config: Config) {
    this.api = new OpenAIApi(new Configuration({ apiKey: this.config.apiKey }));
  }

  private async getBrain(session: Session): Promise<string> {
    if (!this._brainExpiration || this._brainExpiration < Math.floor(Date.now() / 1000)) {
      const sessionPath = ai().getDfSessionPath("SYSTEM");
      const [response] = await ai().dfSessionClient.detectIntent({
        session: sessionPath,
        queryInput: {
          event: {
            name: "OPENAI_BRAIN",
            languageCode: config().language,
          },
        },
      });
      this._brain = response.queryResult.fulfillmentText;
      this._brainExpiration = new Date(Date.now() + BRAIN_TTL_MIN * 60 * 1000).getTime() / 1000;
    }
    return this._brain
      .replace("{user_name}", getSessionName(session))
      .replace("{current_time}", getSessionLocaleTimeString(session))
      .replace("{user_language}", await getLanguageNameFromLanguageCode(getSessionTranslateTo(session)));
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

  private async retrievePreviousInteractions(session: Session) {
    // Get all Interaction where we have a input.text or fulfillment.text in the last 20m
    return (
      await Interaction.find({
        $or: [
          {
            "fulfillment.text": { $ne: null },
            session: session.id,
            createdAt: { $gte: new Date(Date.now() - 20 * 60_000) },
          },
          {
            "input.text": { $ne: null },
            session: session.id,
            createdAt: { $gte: new Date(Date.now() - 20 * 60_000) },
          },
        ],
      }).sort({ createdAt: -1 })
    )
      .map((interaction) => {
        if (interaction.fulfillment.text) {
          return {
            role: ChatCompletionRequestMessageRoleEnum.Assistant,
            content: interaction.fulfillment.text,
            createdAt: interaction.createdAt,
          };
        }
        if (interaction.input.text) {
          return {
            role: ChatCompletionRequestMessageRoleEnum.User,
            content: interaction.input.text,
            createdAt: interaction.createdAt,
          };
        }
      })
      .filter(Boolean);
  }

  async textRequest(
    text: InputParams["text"],
    session: Session,
    role: ChatCompletionRequestMessageRoleEnum = ChatCompletionRequestMessageRoleEnum.User,
  ): Promise<Fulfillment> {
    console.info("text request:", text);

    const systemText = await this.getBrain(session);
    const systemMessage = {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: systemText,
    };

    const userMessage = {
      role: role,
      content: text,
    };

    const previousInteractions =
      role === ChatCompletionRequestMessageRoleEnum.User ? await this.retrievePreviousInteractions(session) : [];

    // Remove any duplicate
    if (previousInteractions.length > 0) {
      const lastInt = previousInteractions[previousInteractions.length - 1];
      if (
        text === lastInt.content &&
        lastInt.role === userMessage.role &&
        // last minute
        lastInt.createdAt > new Date(Date.now() - 1000 * 60)
      ) {
        previousInteractions.pop();
      }
    }

    // Prepend system
    const messages = [
      systemMessage,
      ...previousInteractions.map(({ role, content }) => ({ role, content })),
      userMessage,
    ];
    console.debug("messages :>> ", messages);

    const completion = await this.api.createChatCompletion({
      model: this.config.model,
      messages: messages,
    });

    console.debug("completion :>> ", completion.data.choices[0]);

    const answerMessages = completion.data.choices.map((e) => e.message);
    const answerMessage = answerMessages[0];
    const answerText = answerMessage?.content;

    if (!answerText) {
      return {
        error: {
          message: "OpenAI returned an empty answer",
          data: completion.data,
        },
      };
    }

    return {
      text: answerText,
    };
  }
}

let _instance: OpenAI;
export default (): OpenAI => {
  _instance = _instance || new OpenAI(config().openai);
  return _instance;
};
