import config from "../config";
import GoogleImages from "google-images";

let _instance: GoogleImages;
export default () => {
  if (!_instance) {
    const _config = config().gcloud;
    _instance = new GoogleImages(_config.cseId, _config.apiKey);
  }
  return _instance;
};
