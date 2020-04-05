import ImagesClient from "google-images";
import config from "../config";

const _config = config().gcloud;

const _client = new ImagesClient(_config.cseId, _config.apiKey);

export const client = _client;
