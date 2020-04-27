import { spawn } from "child_process";
import config from "../config";
import { getLocalObjectFromURI } from "../helpers";
import { BufferWithExtension } from "../types";
import fs from "fs";

const TAG = "Play";

const _config = config().play;

/**
 * Map of all processes
 */
const processes = {};

/**
 * Kill all playing processes
 */
export function kill() {
  for (const [pid, level] of Object.entries(processes)) {
    if (level === 0) {
      process.kill((pid as unknown) as number);
      delete processes[pid];
    }
  }
}

/**
 * Play an item
 */
export async function playURI(
  uri: string | Buffer | BufferWithExtension,
  addArgs: string[] = [],
  useFs = false,
  level = 0,
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const localUri = await getLocalObjectFromURI(uri);
    let finalUri: string;

    let proc;
    if (useFs) {
      finalUri = localUri.replace(/\.(.+)$/, "-remixed.$1");
      if (fs.existsSync(finalUri)) {
        return resolve(finalUri);
      }
      console.debug(TAG, `writing remixed file to ${finalUri}`);
      proc = spawn(_config.binaryFs, [localUri, finalUri].concat(addArgs));
    } else {
      finalUri = localUri;
      proc = spawn(_config.binary, [localUri].concat(addArgs));
    }
    processes[proc.pid] = level;

    let stderr = "";
    proc.stderr.on("data", (buf) => (stderr += buf));

    proc.on("close", (err) => {
      delete processes[proc.pid];
      if (err) {
        return reject(stderr);
      }

      return resolve(finalUri);
    });
  });
}

/**
 * Play an item using voice effects
 */
export async function playVoice(uri: string | Buffer | BufferWithExtension) {
  return playURI(uri, _config.addArgs);
}

/**
 * Play an item using voice effects
 */
export async function playVoiceToFile(uri: string | Buffer | BufferWithExtension) {
  return playURI(uri, _config.addArgs, true);
}
