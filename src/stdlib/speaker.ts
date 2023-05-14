import config from "../config";
import { Speaker } from "../abstracts/speaker";
import { DirectSpeaker } from "../lib/direct-speaker";

let _instance: Speaker;
export default () => {
  if (!_instance) {
    const driverName = config().speakerDriver;
    switch (driverName) {
      case "direct":
        _instance = new DirectSpeaker();
        break;
      default:
        throw new Error(`Invalid speaker: <${driverName}>`);
    }
  }
  return _instance;
};
