import { Speaker } from "../../abstracts/speaker";
import { Sonos } from "sonos";
import { File } from "../../stdlib/file";

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

  async play(file: File | string) {
    let uri = "";
    if (typeof file === "string") {
      uri = file;
    } else {
      uri = file.getURI();
    }
    this.device.playNotification(uri);
    return true;
  }
}
