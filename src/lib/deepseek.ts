import { OpenAI } from "openai";
import config from "../config";

let instance: OpenAI | undefined;

export function DeepSeekSDK(): OpenAI {
  if (!instance) {
    const _config = config().deepseek;
    instance = new OpenAI({ apiKey: _config.apiKey, baseURL: "https://api.deepseek.com/v1" });
  }
  return instance;
}
