import ImagesClient from "google-images";
import config from "../config";

let _instance: typeof ImagesClient;
export default () => {
  if (!_instance) {
    const _config = config().gcloud;
    _instance = new ImagesClient(_config.cseId, _config.apiKey);
  }
  return _instance;
};
