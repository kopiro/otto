const speech = require("@google-cloud/speech")();
const { promisify } = require("util");
const _ = require("underscore");
const fs = require("fs");
const Proc = require("../lib/proc");
const config = require("../config");
const { getLocaleFromLanguageCode, uuid } = require("../helpers");
const { tmpDir } = require("../paths");

const TAG = "GCSR";
const SAMPLE_RATE = 16000;

/**
 * Create a recognition stream
 * @param {Object} opt
 * @param {Function} callback
 */
function createRecognizeStream(opt, callback) {
  let resolved = false;

  _.defaults(opt, {
    // If false or omitted, the recognizer will perform continuous recognition
    singleUtterance: true,
    // If true, interim results (tentative hypotheses) may be returned as they become available
    interimResults: true,
    encoding: "LINEAR16",
    sampleRate: SAMPLE_RATE,
    language: config.language
  });

  const stream = speech.streamingRecognize({
    singleUtterance: opt.singleUtterance,
    interimResults: opt.interimResults,
    config: {
      encoding: opt.encoding,
      sampleRateHertz: opt.sampleRate,
      languageCode: getLocaleFromLanguageCode(opt.language)
    }
  });

  stream.on("end", () => {
    if (resolved === false) {
      callback({
        unrecognized: true
      });
    }
  });

  stream.on("error", err => {
    console.error(TAG, err);
    callback(err);
  });

  stream.on("data", data => {
    if (data.results.length > 0) {
      const r = data.results[0];
      if (!_.isEmpty(r.alternatives)) {
        console.debug(TAG, r.alternatives[0].transcript);
      }
      if (r.isFinal) {
        const text = r.alternatives[0].transcript;
        console.info(TAG, "recognized", text);
        resolved = true;
        callback(null, text);
      }
    }
  });

  return stream;
}

/**
 * Recognize a Stream
 */
async function recognizeStream(stream, opt = {}) {
  return new Promise((resolve, reject) => {
    stream.pipe(
      createRecognizeStream(
        {
          interimResults: false,
          language: opt.language
        },
        (err, text) => {
          if (err) return reject(err);
          return resolve(text);
        }
      )
    );
  });
}

/**
 * Start a recognition stream
 * @param {Stream} stream
 * @param {Object} opt
 */
function recognize(stream, opt = {}) {
  return new Promise(async (resolve, reject) => {
    stream.pipe(
      createRecognizeStream(opt, (err, text) => {
        if (err) return reject(err);
        return resolve(text);
      })
    );
  });
}

/**
 * Recognize a local audio file
 */
async function recognizeFile(
  file,
  opt = { convertFile: false, overrideFile: false }
) {
  if (opt.convertFile) {
    const newFile = opt.overrideFile ? file : `${file}.wav`;
    await Proc.spawn("ffmpeg", [
      opt.overrideFile ? "-y" : "",
      "-i",
      file,
      "-acodec",
      "pcm_s16le",
      "-ar",
      SAMPLE_RATE,
      "-ac",
      "1",
      newFile
    ]);
    file = newFile;
  }

  return recognizeStream(fs.createReadStream(file), opt);
}

/**
 * Recognize a buffer
 */
async function recognizeBuffer(buffer, opt = {}) {
  const tmpFile = `${tmpDir}/${uuid()}.wav`;
  await promisify(fs.writeFile)(tmpFile, buffer);
  return recognizeFile(tmpFile, {
    convertFile: true,
    overrideFile: true,
    ...opt
  });
}

module.exports = {
  recognizeStream,
  recognizeBuffer,
  recognizeFile,
  createRecognizeStream,
  recognize
};
