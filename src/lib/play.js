const path = require('path');
const { spawn } = require('child_process');
const config = require('../config');
const { tmpDir } = require('../paths');
const { getLocalObjectFromURI, uuid } = require('../helpers');

const _config = config.play;

const processes = {};

/**
 * Kill all playing processes
 */
function kill() {
  for (const pid of Object.keys(processes)) {
    process.kill(pid);
    delete processes[pid];
  }
}

/**
 * Play an item
 * @param {String} uri URI or file
 * @param {Array} addArgs Eventual voice effects
 */
async function playURI(uri, addArgs = [], program = 'play') {
  return new Promise(async (resolve, reject) => {
    const localUri = await getLocalObjectFromURI(uri);

    const proc = spawn(program, [localUri].concat(addArgs));
    processes[proc.pid] = true;

    let stderr = '';
    proc.stderr.on('data', (buf) => {
      stderr += buf;
    });

    proc.on('close', (err) => {
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
 * @param {String} file
 */
async function playVoice(uri) {
  return playURI(uri, _config.addArgs);
}

/**
 * Play an item using voice effects to a temporary file
 * @param {String} uri
 */
async function playVoiceToFile(uri, file) {
  await playURI(uri, [file].concat(_config.addArgs), 'sox');
  return file;
}

/**
 * Play an item using voice effects to a temporary file
 * @param {String} uri
 */
function playVoiceToTempFile(uri) {
  const file = path.join(tmpDir, `${uuid()}.mp3`);
  return playVoiceToFile(uri, file);
}

module.exports = {
  playURI,
  playVoice,
  playVoiceToFile,
  playVoiceToTempFile,
  kill,
};
