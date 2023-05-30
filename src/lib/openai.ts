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

  async textRequest(
    text: InputParams["text"],
    session: Session,
    role: ChatCompletionRequestMessageRoleEnum = ChatCompletionRequestMessageRoleEnum.User,
    ignoreHistory: boolean = false,
  ): Promise<Fulfillment> {
    console.info("text request:", text);

    const now = Math.floor(Date.now() / 1000);
    const interationTTLSeconds = this.config.interactionTTLMinutes * 60;

    if ((session.openaiLastInteraction ?? 0) + interationTTLSeconds < now) {
      console.debug(`resetting chat, as more than ${this.config.interactionTTLMinutes}m passed since last interaction`);
      session.openaiMessages = [];
    }

    const systemText = await this.getBrain(session);
    const systemMessage = {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: systemText,
    };

    const userMessage = {
      role: role,
      content: text,
    };

    session.openaiMessages = session.openaiMessages ?? [];

    // Prepend system
    const messages = [systemMessage, ...(ignoreHistory ? [] : session.openaiMessages), userMessage];
    console.debug("messages :>> ", messages);

    const completion = await this.api.createChatCompletion({
      model: this.config.model,
      messages: messages,
    });

    console.debug("completion :>> ", completion.data.choices[0]);

    const answerMessages = completion.data.choices.map((e) => e.message);
    const answerMessage = answerMessages[0];
    const answerText = answerMessage?.content;

    if (!ignoreHistory) {
      session.openaiLastInteraction = now;
      session.openaiMessages = [...session.openaiMessages, userMessage, answerMessage].filter(
        (e) => e.role !== ChatCompletionRequestMessageRoleEnum.System,
      );
      session.save();
    }

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
