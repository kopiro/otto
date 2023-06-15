import config from "../config";
import { DirectSpeaker } from "../lib/speaker/direct-speaker";

import { File } from "../stdlib/file";

export interface ISpeaker {
  play(file: string | File): Promise<void>;
  kill(): void;
}

export class Speaker {
  private static instance: ISpeaker;
  static getInstance(): ISpeaker {
    if (!Speaker.instance) {
      const driverName = config().speakerDriver;
      switch (driverName) {
        case "direct":
          Speaker.instance = new DirectSpeaker();
          break;
        default:
          throw new Error(`Invalid speaker: <${driverName}>`);
      }
    }
    return Speaker.instance;
  }
}
