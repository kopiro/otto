import config from "../config";
import { GoogleSpeechRecognizer } from "../lib/google-speech-recognizer";

export default (() => {
  const driverName = config().speechRecognizerDriver;
  switch (driverName) {
    case "google":
      return new GoogleSpeechRecognizer();
    default:
      throw new Error(`Invalid speech-recognizer: <${driverName}>`);
  }
})();
