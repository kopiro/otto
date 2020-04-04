import path from "path";
import { spawn } from "child_process";
import config from "../config";
import { tmpDir } from "../paths";
import { getLocalObjectFromURI, uuid } from "../helpers";

const _config = config().play;

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
 *
 *
 */
export async function playURI(uri, addArgs = [], level = 0, program = null) {
  return new Promise(async (resolve, reject) => {
    const localUri = await getLocalObjectFromURI(uri);

    const proc = spawn(program || _config.binary, [localUri].concat(addArgs));
    processes[proc.pid] = level;

    let stderr = "";
    proc.stderr.on("data", buf => {
      stderr += buf;
    });

    proc.on("close", err => {
      delete processes[proc.pid];
      if (err) {
        return reject(stderr);
      }

      return resolve(localUri);
    });
  });
}

/**
 * Play an item using voice effects
 *
 */
export async function playVoice(uri) {
  return playURI(uri, _config.addArgs);
}

/**
 * Play an item using voice effects to a temporary file
 *
 */
export async function playVoiceToFile(uri, file) {
  await playURI(uri, [file].concat(_config.addArgs), 0, "sox");
  return file;
}

/**
 * Play an item using voice effects to a temporary file
 *
 */
export function playVoiceToTempFile(uri) {
  const file = path.join(tmpDir, `${uuid()}.mp3`);
  return playVoiceToFile(uri, file);
}
