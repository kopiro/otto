import * as Proc from "../../stdlib/proc";
import { File } from "../../stdlib/file";
import { ChildProcess } from "child_process";
import { ISpeaker } from "../../stdlib/speaker";
import { getLocalObjectFromURI } from "../../helpers";
export class DirectSpeaker implements ISpeaker {
  private pids = new Set<ChildProcess>();

  async play(fileOrString: string | File) {
    const file = await getLocalObjectFromURI(fileOrString, "mp3");
    const { child, result } = Proc.processSpawn("play", [file.getAbsolutePath()]);

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
