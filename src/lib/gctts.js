const GCTTS = require('@google-cloud/text-to-speech');
const _ = require('underscore');
const md5 = require('md5');
const fs = require('fs');
const config = require('../config');
const { cacheDir } = require('../paths');
const { uuid, getLocaleFromLanguageCode } = require('../helpers');

const _config = config.gcloud.tts;
const TAG = 'GCTTS';
const CACHE_REGISTRY_FILE = `${cacheDir}/${TAG}.json`;

// Creates a client

const client = new GCTTS.TextToSpeechClient();

let cache = {};

/**
 * Load the cache registry from file
 */
function loadCacheRegistry() {
  try {
    const registry = JSON.parse(fs.readFileSync(CACHE_REGISTRY_FILE).toString());
    if (registry.audio == null || registry.voices == null) {
      throw new Error('Invalid registry format');
    }
    cache = registry;
  } catch (ex) {
    cache = {
      audio: {},
      voices: {},
    };
  }
}

/**
 * Set the cache item for the audio
 * @param {String} text The spoken text
 * @param {Object} opt
 * @param {String} file File containing the audio
 */
async function setCacheForAudio(text, opt, file) {
  return new Promise((resolve) => {
    const key = md5(text + JSON.stringify(opt));
    cache.audio[key] = file;
    fs.writeFile(CACHE_REGISTRY_FILE, JSON.stringify(cache), resolve);
  });
}

/**
 * Get the cache item for an audio
 * @param {String} text
 * @param {Object} opt
 * @returns {String} The file containing the audio
 */
function getCacheForAudio(text, opt) {
  const key = md5(text + JSON.stringify(opt));
  const file = cache.audio[key];
  if (file != null && fs.existsSync(file)) {
    return file;
  }
  return null;
}

/**
 * Retrieve the voice title based on language and gender
 * @param {*} opt
 */
async function getVoice(opt) {
  const locale = getLocaleFromLanguageCode(opt.language);
  return {
    languageCode: locale,
    name: `${locale}-Wavenet-A`,
    ssmlGender: opt.gender.toUpperCase(),
  };
}

/**
 * Download the audio file for that sentence and options
 * @param {String} text Sentence
 * @param {Object} opt
 */
function getAudioFile(text, opt = {}) {
  return new Promise(async (resolve, reject) => {
    _.defaults(opt, {
      gender: _config.gender,
      language: config.language,
    });

    // If file has been downloaded, just serve it
    let file = getCacheForAudio(text, opt);
    if (file) {
      return resolve(file);
    }

    // Find the voice title by options
    const voice = await getVoice(opt);
    const isSSML = /<speak>/.test(text);

    const input = {};
    if (isSSML) input.ssml = text;
    else input.text = text;

    // Call the API
    return client.synthesizeSpeech(
      {
        input,
        voice,
        audioConfig: {
          audioEncoding: 'MP3',
        },
      },
      (err, data) => {
        if (err) {
          return reject(err);
        }

        file = `${cacheDir}/${TAG}_${uuid()}.mp3`;
        return fs.writeFile(file, data.audioContent, 'binary', (err2) => {
          if (err2) {
            return reject(err2);
          }

          // Save this entry onto cache
          setCacheForAudio(text, opt, file);
          return resolve(file);
        });
      },
    );
  });
}

loadCacheRegistry();

module.exports = {
  getAudioFile,
};
