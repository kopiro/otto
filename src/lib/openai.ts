import { Configuration, OpenAIApi } from "openai";
import config from "../config";

let instance: OpenAIApi | undefined;

export function OpenAIApiSDK(): OpenAIApi {
  if (!instance) {
    const _config = config().openai;
    instance = new OpenAIApi(new Configuration({ apiKey: _config.apiKey }));
  }
  return instance;
}
