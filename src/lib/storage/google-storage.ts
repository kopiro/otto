import config from "../../config";
import { Storage as GStorage } from "@google-cloud/storage";
import { Storage } from "../../abstracts/storage";

export class GoogleStorage extends Storage {
  storage: GStorage;
  config: any;

  constructor() {
    super();
    this.config = config().gcloud.storage;
    this.storage = new GStorage();
  }

  async getDefaultDirectory() {
    return this.storage.bucket(this.config.bucket);
  }

  getPublicBaseURL() {
    return `https://storage.googleapis.com/${this.config.bucket}`;
  }
}
