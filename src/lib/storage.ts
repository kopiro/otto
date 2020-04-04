import config from "../config";
import { Storage } from "@google-cloud/storage";

export const storage = new Storage();

export async function getDefaultBucket() {
  return storage.bucket((config().gcloud.storage as unknown) as string);
}
