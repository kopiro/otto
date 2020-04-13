import { GoogleTranslator } from "../lib/google-translator";
import config from "../config";

export default (() => {
  const driverName = config().translatorDriver;
  switch (driverName) {
    case "google":
      return new GoogleTranslator();
    default:
      throw new Error(`Invalid translator: <${driverName}>`);
  }
})();
