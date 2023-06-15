import config from "../config";
import { GoogleStorage } from "../lib/storage/google-storage";

export interface IStorage {
  getPublicBaseURL(): string;
}

export class Storage {
  private static instance: Storage;
  static getInstance(): Storage {
    if (!Storage.instance) {
      const driverName = config().storageDriver;
      switch (driverName) {
        case "google":
          Storage.instance = new GoogleStorage();
          break;
        default:
          throw new Error(`Invalid storage: <${driverName}>`);
      }
    }
    return Storage.instance;
  }
}
