import config from "../config";
import GoogleImages from "google-images";

let instance: GoogleImages | undefined;

export function GoogleImagesSDK(): GoogleImages {
  if (!instance) {
    const _config = config().gcloud;
    instance = new GoogleImages(_config.cseId, _config.apiKey);
  }
  return instance;
}
