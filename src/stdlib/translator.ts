import { GoogleTranslator } from "../lib/google-translator";
import config from "../config";
import { Translator } from "../abstracts/translator";

let _instance: Translator;
export default (): Translator => {
  if (!_instance) {
    const driverName = config().translatorDriver;
    switch (driverName) {
      case "google":
        _instance = new GoogleTranslator();
        break;
      default:
        throw new Error(`Invalid translator: <${driverName}>`);
    }
  }
  return _instance;
};
