import * as Proc from "../../stdlib/proc";
import { File } from "../../stdlib/file";
import { ChildProcess } from "child_process";
import { ISpeaker } from "../../stdlib/speaker";
export class DirectSpeaker implements ISpeaker {
  private pids = new Set<ChildProcess>();

  async play(file: string | File) {
    let uri;
    if (typeof file === "string") {
      uri = file;
    } else {
      uri = file.getAbsolutePath();
    }

    const { child, result } = Proc.processSpawn("play", [uri]);

    this.pids.add(child);
    child.on("close", () => {
      this.pids.delete(child);
    });

    await result;
  }

  kill() {
    for (const pid of this.pids) {
      pid.kill();
    }
  }
}
