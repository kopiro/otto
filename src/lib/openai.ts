import { OpenAI } from "openai";
import config from "../config";

let instance: OpenAI | undefined;

export function OpenAISDK(): OpenAI {
  if (!instance) {
    const _config = config().openai;
    instance = new OpenAI({ apiKey: _config.apiKey });
  }
  return instance;
}
