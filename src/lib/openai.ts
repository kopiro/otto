import { ChatCompletionRequestMessageRoleEnum, Configuration, OpenAIApi } from "openai";
import { Fulfillment, CustomError, AIAction, InputParams, Session } from "../types";
import config from "../config";
import { Signale } from "signale";
import ai from "../stdlib/ai";

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

  private async getBrain(): Promise<string> {
    const sessionPath = ai().getDFSessionPath("__system__");
    const [response] = await ai().dfSessionClient.detectIntent({
      session: sessionPath,
      queryInput: {
        event: {
          name: "__openai_brain__",
          languageCode: config().language,
        },
      },
      queryParams: {},
    });
    return response.queryResult.fulfillmentText;
  }

  async textRequest(text: InputParams["text"], session: Session): Promise<Fulfillment> {
    console.info("text request:", text);

    const now = Math.floor(Date.now() / 1000);
    const interationTTLSeconds = this.config.interactionTTLMinutes * 60;

    if ((session.openaiLastInteraction ?? 0) + interationTTLSeconds < now) {
      console.log("resetting chat log", session.openaiLastInteraction, now);
      session.openaiMessages = [];
    }

    const systemText = await this.getBrain();
    const systemMessage = {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: systemText,
    };

    const userMessage = {
      role: ChatCompletionRequestMessageRoleEnum.User,
      content: text,
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
      text: answerText + "***",
    };
  }
}

let _instance: OpenAI;
export default (): OpenAI => {
  _instance = _instance || new OpenAI(config().openai);
  return _instance;
};
