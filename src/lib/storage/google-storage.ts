import config from "../../config";
import { Storage as GStorage } from "@google-cloud/storage";
import { IStorage } from "../../stdlib/storage";
export class GoogleStorage implements IStorage {
  storage: GStorage;
  conf: {
    bucket: string;
  };

  constructor() {
    this.conf = config().gcloud.storage;
    this.storage = new GStorage();
  }

  async getDefaultDirectory() {
    return this.storage.bucket(this.conf.bucket);
  }

  getPublicBaseURL() {
    return `https://storage.googleapis.com/${this.conf.bucket}`;
  }
}
