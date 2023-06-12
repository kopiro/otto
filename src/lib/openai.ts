import { Configuration, OpenAIApi } from "openai";
import config from "../config";

let _instance: OpenAIApi;
export default () => {
  if (!_instance) {
    const _config = config().openai;
    _instance = new OpenAIApi(new Configuration({ apiKey: _config.apiKey }));
  }
  return _instance;
};
