import { Storage } from "../abstracts/storage";
import config from "../config";
import { GoogleStorage } from "../lib/storage/google-storage";

let _instance: Storage;
export default (): Storage => {
  if (!_instance) {
    const driverName = config().storageDriver;
    switch (driverName) {
      case "google":
        _instance = new GoogleStorage();
        break;
      default:
        throw new Error(`Invalid storage: <${driverName}>`);
    }
  }
  return _instance;
};
