import config from "../config";
import { DirectSpeaker } from "../lib/direct-speaker";
import { SonosSpeaker } from "../lib/sonos-speaker";

export default (() => {
  const driverName = config().speakerDriver;
  switch (driverName) {
    case "direct":
      return new DirectSpeaker();
    case "sonos":
      return new SonosSpeaker(config().sonos);
    default:
      throw new Error(`Invalid speaker: <${driverName}>`);
  }
})();
