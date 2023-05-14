import { ChatCompletionRequestMessageRoleEnum, Configuration, OpenAIApi } from "openai";
import { Fulfillment, CustomError, AIAction, InputParams, Session } from "../types";
import config from "../config";
import { Signale } from "signale";
import ai from "../stdlib/ai";
import { getLanguageLongStringFromLanguageCode } from "../helpers";

type Config = {
  apiKey: string;
  interactionTTLMinutes: number;
  model: string;
};

const TAG = "OpenAI";
const console = new Signale({
  scope: TAG,
});

class OpenAI {
  private api: OpenAIApi;
  private _brain: string;

  constructor(private config: Config) {
    this.api = new OpenAIApi(new Configuration({ apiKey: this.config.apiKey }));
  }

  private async getBrain(session: Session): Promise<string> {
    if (!this._brain) {
      const sessionPath = ai().getDFSessionPath("SYSTEM");
      const [response] = await ai().dfSessionClient.detectIntent({
        session: sessionPath,
        queryInput: {
          event: {
            name: "OPENAI_BRAIN",
            languageCode: config().language,
            parameters: {
              fields: {
                user_name: {
                  stringValue: session.getName(),
                },
                user_language: {
                  stringValue: session.getTranslateTo(),
                },
                current_time: {
                  stringValue: new Date().toISOString(),
                },
              },
            },
          },
        },
      });
      this._brain = response.queryResult.fulfillmentText;
    }
    return this._brain
      .replace("{user_name}", session.getName())
      .replace("{user_language}", await getLanguageLongStringFromLanguageCode(session.getTranslateTo()))
      .replace("{current_time}", new Date().toISOString());
  }

  async textRequest(text: InputParams["text"], session: Session, addToHistory: boolean = true): Promise<Fulfillment> {
    console.info("text request:", text);

    const now = Math.floor(Date.now() / 1000);
    const interationTTLSeconds = this.config.interactionTTLMinutes * 60;

    if ((session.openaiLastInteraction ?? 0) + interationTTLSeconds < now) {
      console.log(`resetting chat, as more than ${this.config.interactionTTLMinutes}m passed since last interaction`);
      session.openaiMessages = [];
    }

    const systemText = await this.getBrain(session);
    const systemMessage = {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: systemText,
    };

    const userMessage = {
      role: ChatCompletionRequestMessageRoleEnum.User,
      content: text,
    };

    session.openaiMessages = session.openaiMessages ?? [];

    // Prepend system
    const messages = [systemMessage, ...session.openaiMessages, userMessage];
    console.log("messages :>> ", messages);

    const completion = await this.api.createChatCompletion({
      model: this.config.model,
      messages: messages,
    });

    console.log("completion :>> ", completion.data);

    const answerMessages = completion.data.choices.map((e) => e.message);
    const answerMessage = answerMessages[0];
    const answerText = answerMessage?.content;

    session.openaiLastInteraction = now;
    if (addToHistory) {
      session.openaiMessages = [...session.openaiMessages, userMessage, answerMessage];
    }

    session.save();

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
