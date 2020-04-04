import ImagesClient from "google-images";
import config from "../config";

const _config = config().gcloud;

const _ = new ImagesClient(_config.cseId, _config.apiKey);
export default _;
