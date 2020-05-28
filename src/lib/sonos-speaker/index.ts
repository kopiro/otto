import { Speaker } from "../../abstracts/speaker";
import { Sonos } from "sonos";

type SonosConfig = {
  ip: string;
};

export class SonosSpeaker extends Speaker {
  config: SonosConfig;
  device: any;

  constructor(config: SonosConfig) {
    super();
    this.config = config;
    this.device = new Sonos(this.config.ip);
  }

  async playURI(uri: string) {
    console.log("uri", uri);
    const a = await this.device.playNotification(uri);
    return a;
  }
}
