import config from "../config";
import { QdrantClient } from "@qdrant/js-client-rest";

let instance: QdrantClient | undefined;

export function QDrantSDK(): QdrantClient {
  if (!instance) {
    const _config = config().qdrant;
    instance = new QdrantClient({ url: _config.url, apiKey: _config.token });
  }
  return instance;
}
