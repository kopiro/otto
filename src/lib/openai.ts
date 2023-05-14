import { ChatCompletionRequestMessageRoleEnum, Configuration, CreateChatCompletionRequest, OpenAIApi } from "openai";
import { Fulfillment, CustomError, AIAction, InputParams, Session, FullfillmentStringKeys } from "../types";
import { readFile } from "fs/promises";
import { keysDir } from "../paths";
import path from "path";
import type { IOBag } from "../stdlib/iomanager";
import config from "../config";
import { Signale } from "signale";
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

  constructor(private config: Config) {
    this.api = new OpenAIApi(new Configuration({ apiKey: this.config.apiKey }));
  }

  private async getTextBrain(): Promise<string> {
    return await readFile(path.join(keysDir, "openai-header.txt"), "utf-8");
  }

  private async fillVariables(text: string, session: Session): Promise<string> {
    const userLanguage = await getLanguageLongStringFromLanguageCode(session.getTranslateTo());
    return text
      .replace(new RegExp("{user_name}", "g"), session.getName())
      .replace(new RegExp("{user_language}", "g"), userLanguage)
      .replace(new RegExp("{current_date}", "g"), new Date().toLocaleDateString())
      .replace(new RegExp("{current_time}", "g"), new Date().toLocaleTimeString());
  }

  async textRequest(text: InputParams["text"], session: Session): Promise<Fulfillment> {
    console.info("text request:", text);

    const now = Math.floor(Date.now() / 1000);
    const interationTTLSeconds = this.config.interactionTTLMinutes * 60;

    if ((session.openaiLastInteraction ?? 0) + interationTTLSeconds < now) {
      console.log("resetting chat log", session.openaiLastInteraction, now);
      session.openaiMessages = [];
    }

    const systemText = await this.getTextBrain();
    const systemMessage = {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: await this.fillVariables(systemText, session),
    };

    const userMessage = {
      role: ChatCompletionRequestMessageRoleEnum.User,
      content: await this.fillVariables(text, session),
    };

    session.openaiMessages = session.openaiMessages ?? [];
    session.openaiMessages = [...session.openaiMessages, userMessage];

    // Prepend system
    const messages = [systemMessage, ...session.openaiMessages];

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
    session.openaiMessages = [...session.openaiMessages, answerMessage];
    session.save();

    if (!answerText) {
      return {
        error: {
          message: "[internal error] - OpenAI returned an empty answer",
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
