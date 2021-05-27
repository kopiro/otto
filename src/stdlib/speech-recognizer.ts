import { SpeechRecognizer } from "../abstracts/speech-recognizer";
import config from "../config";
import { GoogleSpeechRecognizer } from "../lib/google-speech-recognizer";

let _instance: SpeechRecognizer;
export default () => {
  if (_instance) {
    const driverName = config().speechRecognizerDriver;
    switch (driverName) {
      case "google":
        _instance = new GoogleSpeechRecognizer();
        break;
      default:
        throw new Error(`Invalid speech-recognizer: <${driverName}>`);
    }
  }
  return _instance;
};
