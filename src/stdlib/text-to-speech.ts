import config from "../config";
import { TextToSpeech } from "../abstracts/text-to-speech";
import { GoogleTextToSpeech } from "../lib/google-text-to-speech";
import { PollyTextToSpeech } from "../lib/polly";

let _instance: TextToSpeech;
export default (): TextToSpeech => {
  if (!_instance) {
    const driverName = config().textToSpeechDriver;
    switch (driverName) {
      case "google":
        _instance = new GoogleTextToSpeech();
        break;
      case "polly":
        _instance = new PollyTextToSpeech();
        break;
      default:
        throw new Error(`Invalid text-to-speech: <${driverName}>`);
    }
  }
  return _instance;
};
