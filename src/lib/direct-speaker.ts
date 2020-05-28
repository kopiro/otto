import { Speaker } from "../abstracts/speaker";
import * as Proc from "./proc";

export class DirectSpeaker extends Speaker {
  playURI(uri: string) {
    return Proc.spawn("play", [uri]);
  }
}
