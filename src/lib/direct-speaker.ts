import { Speaker } from "../abstracts/speaker";
import * as Proc from "./proc";
import { File } from "../stdlib/file";

export class DirectSpeaker extends Speaker {
  play(file: string | File) {
    let uri;
    if (typeof file === "string") {
      uri = file;
    } else {
      uri = file.getAbsoluteFSPath();
    }
    return Proc.spawn("play", [uri]);
  }
}
