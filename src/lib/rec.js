const TAG = "Rec";

const _ = require("underscore");
const { spawn } = require("child_process");

let proc = null;

// returns a Readable stream
function start(opt = {}) {
  if (proc) proc.kill();

  _.defaults(opt, {
    sampleRate: 16000,
    threshold: "3",
    stopOnSilence: false,
    verbose: false,
    time: false
  });

  let args = [
    "-q",
    "-r",
    opt.sampleRate,
    "-c",
    "1",
    "-e",
    "signed-integer",
    "-b",
    "16",
    "-t",
    "wav",
    "-"
  ];

  if (opt.stopOnSilence) {
    // silence 1 0.1 3% 1 3.0 3%
    args = args.concat(
      "silence",
      "1",
      "0.1",
      `${opt.threshold}%`,
      "1",
      "3.0",
      `${opt.threshold}%`
    );
  }

  if (opt.time) {
    args = args.concat("trim", "0", opt.time);
  }

  console.debug(TAG, "Recording...");
  proc = spawn("rec", args, {
    encoding: "binary"
  });

  proc.stdout.on("end", () => {
    console.debug(TAG, "end");
  });

  return proc.stdout;
}

function getStream() {
  if (proc == null) return null;
  return proc.stdout;
}

function stop() {
  if (proc == null) return;

  console.log(TAG, "stop");
  proc.kill();
}

module.exports = { start, stop, getStream };
