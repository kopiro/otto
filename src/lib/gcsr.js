const TAG = 'GCSR';

const speech = require('@google-cloud/speech')();

const _ = require('underscore');
const fs = require('fs');

const Proc = apprequire('proc');
const { promisify } = require('util');

exports.SAMPLE_RATE = 16000;

/**
 * Start a recognition stream
 * @param {Stream} stream
 * @param {Object} opt
 */
exports.recognize = function (stream, opt = {}) {
  return new Promise(async (resolve, reject) => {
    stream.pipe(
      exports.createRecognizeStream(opt, (err, text) => {
        if (err) return reject(err);
        resolve(text);
      }),
    );
  });
};

/**
 * Create a recognition stream
 * @param {Object} opt
 * @param {Function} callback
 */
exports.createRecognizeStream = function (opt, callback) {
  let resolved = false;

  _.defaults(opt, {
    // If false or omitted, the recognizer will perform continuous recognition
    singleUtterance: true,
    // If true, interim results (tentative hypotheses) may be returned as they become available
    interimResults: true,
    encoding: 'LINEAR16',
    sampleRate: exports.SAMPLE_RATE,
    language: config.language,
  });

  const stream = speech.streamingRecognize({
    singleUtterance: opt.singleUtterance,
    interimResults: opt.interimResults,
    config: {
      encoding: opt.encoding,
      sampleRateHertz: opt.sampleRate,
      languageCode: getLocaleFromLanguageCode(opt.language),
    },
  });

  stream.on('end', () => {
    if (resolved === false) {
      return callback({
        unrecognized: true,
      });
    }
  });

  stream.on('error', (err) => {
    console.error(TAG, err);
    callback(err);
  });

  stream.on('data', (data) => {
    if (data.results.length > 0) {
      const r = data.results[0];
      if (!_.isEmpty(r.alternatives)) {
        console.debug(TAG, r.alternatives[0].transcript);
      }
      if (r.isFinal) {
        const text = r.alternatives[0].transcript;
        console.info(TAG, 'recognized', text);
        resolved = true;
        callback(null, text);
      }
    }
  });

  return stream;
};

/**
 * Recognize a local audio file
 */
exports.recognizeFile = async function (
  file,
  opt = {
    convertFile: false,
    overrideFile: false,
  },
) {
  if (opt.convertFile === true) {
    const new_file = opt.overrideFile ? file : `${file}.wav`;
    await Proc.spawn('ffmpeg', [
      opt.overrideFile ? '-y' : '',
      '-i',
      file,
      '-acodec',
      'pcm_s16le',
      '-ar',
      exports.SAMPLE_RATE,
      '-ac',
      '1',
      new_file,
    ]);
    file = new_file;
  }

  return exports.recognizeStream(fs.createReadStream(file), opt);
};

/**
 * Recognize a buffer
 */
exports.recognizeBuffer = async function (buffer, opt = {}) {
  const tmp_file = `${__tmpdir}/${uuid()}.wav`;
  await promisify(fs.writeFile)(tmp_file, buffer);
  return exports.recognizeFile(
    tmp_file,
    Object.assign(
      {
        convertFile: true,
        overrideFile: true,
      },
      opt,
    ),
  );
};

/**
 * Recognize a Stream
 */
exports.recognizeStream = async function (stream, opt = {}) {
  return new Promise((resolve, reject) => {
    stream.pipe(
      exports.createRecognizeStream(
        {
          interimResults: false,
          language: opt.language,
        },
        (err, text) => {
          if (err) return reject(err);
          resolve(text);
        },
      ),
    );
  });
};
