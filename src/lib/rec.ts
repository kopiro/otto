import { spawn, ChildProcess } from "child_process";
import stream from "stream";

import { Signale } from "signale";

const TAG = "Rec";
const console = new Signale({
  scope: TAG,
});

let proc: ChildProcess = null;

// returns a Readable stream
export function start(sampleRate = 16000, threshold = 3, stopOnSilence = false, time = 0): stream.Readable {
  let args = ["-q", "-r", sampleRate.toString(), "-c", "1", "-e", "signed-integer", "-b", "16", "-t", "wav", "-"];

  if (stopOnSilence) {
    // silence 1 0.1 3% 1 3.0 3%
    args = args.concat("silence", "1", "0.1", `${threshold}%`, "1", "3.0", `${threshold}%`);
  }

  if (time > 0) {
    args = args.concat("trim", "0", time.toString());
  }

  console.debug("Recording...");
  if (proc) {
    proc.kill();
  }

  proc = spawn("rec", args);

  proc.stdout.on("end", () => {
    console.debug("end");
  });

  return proc.stdout;
}

export function getProc(): ChildProcess {
  return proc;
}

export function getStream(): stream.Readable {
  return proc?.stdout;
}

export function stop() {
  if (proc == null) return;

  console.log("stop");
  proc.kill();
}
