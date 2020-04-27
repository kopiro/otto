import config from "../config";
import { Storage } from "@google-cloud/storage";

export class GoogleStorage {
  storage: Storage;
  config: any;

  constructor() {
    this.config = config().gcloud.storage;
    this.storage = new Storage();
  }

  async getDefaultDirectory() {
    return this.storage.bucket(this.config.bucket);
  }

  getPublicBaseURL() {
    return `https://storage.googleapis.com/${this.config.bucket}`;
  }
}
