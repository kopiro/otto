import config from "../config";
import { GoogleTextToSpeech } from "../lib/google-text-to-speech";
import { PollyTextToSpeech } from "../lib/polly";

export default (() => {
  const driverName = config().textToSpeechDriver;
  switch (driverName) {
    case "google":
      return new GoogleTextToSpeech();
    case "polly":
      return new PollyTextToSpeech();
    default:
      throw new Error(`Invalid text-to-speech: <${driverName}>`);
  }
})();
