import config from "../config";
import { Speaker } from "../abstracts/speaker";
import { DirectSpeaker } from "../lib/direct-speaker";
import { SonosSpeaker } from "../lib/sonos-speaker";

let _instance: Speaker;
export default () => {
  if (!_instance) {
    const driverName = config().speakerDriver;
    switch (driverName) {
      case "direct":
        _instance = new DirectSpeaker();
        break;
      case "sonos":
        _instance = new SonosSpeaker(config().sonos);
        break;
      default:
        throw new Error(`Invalid speaker: <${driverName}>`);
    }
  }
  return _instance;
};
