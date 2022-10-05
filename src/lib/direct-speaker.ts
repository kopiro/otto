import { Speaker } from "../abstracts/speaker";
import * as Proc from "./proc";
import { File } from "../stdlib/file";
import { ChildProcess } from "child_process";

export class DirectSpeaker extends Speaker {
  private pids = new Set<ChildProcess>();

  play(file: string | File) {
    let uri;
    if (typeof file === "string") {
      uri = file;
    } else {
      uri = file.getAbsolutePath();
    }

    const { child, result } = Proc.spawn("play", [uri]);

    this.pids.add(child);
    child.on("close", () => {
      this.pids.delete(child);
    });

    return result;
  }

  kill() {
    for (const pid of this.pids) {
      pid.kill();
    }
  }
}
