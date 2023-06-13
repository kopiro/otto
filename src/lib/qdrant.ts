import config from "../config";
import { QdrantClient } from "@qdrant/js-client-rest";

let _instance: QdrantClient;
export default () => {
  if (!_instance) {
    const _config = config().qdrant;
    _instance = new QdrantClient({ url: _config.url });
  }
  return _instance;
};
