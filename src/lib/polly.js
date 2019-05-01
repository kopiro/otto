const _ = require('underscore');
const md5 = require('md5');
const fs = require('fs');
const { promisify } = require('util');
const aws = require('../lib/aws');
const config = require('../config');
const { cacheDir } = require('../paths');
const { getLocaleFromLanguageCode, uuid } = require('../helpers');

const TAG = 'Polly';

const _config = config.aws.polly;
const CACHE_REGISTRY_FILE = `${cacheDir}/${TAG}.json`;

const client = new aws.Polly({
  signatureVersion: 'v4',
  region: 'eu-west-1',
});

let cache = null;

/**
 * Load the cache registry from file
 */
function getCacheRegistry() {
  if (cache) return cache;

  try {
    const registry = JSON.parse(fs.readFileSync(CACHE_REGISTRY_FILE).toString());
    if (registry.audio == null || registry.voices == null) {
      throw new Error(`Invalid registry format for ${CACHE_REGISTRY_FILE} file`);
    }
    cache = registry;
  } catch (ex) {
    cache = {
      audio: {},
      voices: {},
    };
  }
  return cache;
}
async function saveCacheRegistry() {
  return promisify(fs.writeFile)(CACHE_REGISTRY_FILE, JSON.stringify(getCacheRegistry()));
}

/**
 * Set the cache item for the voice
 * @param {Object} opt
 * @param {String} voice
 */
async function setCacheForVoice(opt, voice) {
  getCacheRegistry().voices[JSON.stringify(opt)] = voice;
  return saveCacheRegistry();
}

/**
 * Get the cache for a voice
 * @param {Object} opt
 */
function getCacheForVoice(opt) {
  return getCacheRegistry().voices[JSON.stringify(opt)];
}

/**
 * Set the cache item for the audio
 * @param {String} text The spoken text
 * @param {Object} opt
 * @param {String} file File containing the audio
 */
async function setCacheForAudio(text, opt, file) {
  const key = md5(text + JSON.stringify(opt));
  getCacheRegistry().audio[key] = file;
  return saveCacheRegistry();
}

/**
 * Get the cache item for an audio
 * @param {String} text
 * @param {Object} opt
 * @returns {String} The file containing the audio
 */
function getCacheForAudio(text, opt) {
  const key = md5(text + JSON.stringify(opt));
  const file = getCacheRegistry().audio[key];
  if (file != null && fs.existsSync(file)) {
    return file;
  }
  return null;
}

/**
 * Retrieve the voice title based on language and gender
 * @param {Object} opt
 */
function getVoice(opt) {
  return new Promise((resolve, reject) => {
    const locale = getLocaleFromLanguageCode(opt.language);
    let voice = getCacheForVoice(opt);
    if (voice) {
      return resolve(voice);
    }

    // Call the API to retrieve all voices in that locale
    client.describeVoices(
      {
        LanguageCode: locale,
      },
      async (err, data) => {
        if (err != null) {
          return reject(err);
        }

        // Filter voice by selected gender
        voice = data.Voices.find(v => v.Gender == opt.gender);

        if (voice == null) {
          console.debug(
            TAG,
            `falling back to language ${config.language} instead of ${opt.language}`,
          );
          voice = await getVoice(
            _.extend({}, opt, {
              language: config.language,
            }),
          );
          return resolve(voice);
        }

        // Save for later uses
        setCacheForVoice(opt, voice);
        return resolve(voice);
      },
    );
  });
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
    const file = getCacheForAudio(text, opt);
    if (file) {
      return resolve(file);
    }

    // Find the voice title by options
    const voice = await getVoice(opt);
    const isSSML = /<speak>/.test(text);

    // TODO: split by text length so that Polly can process

    // Call the API
    client.synthesizeSpeech(
      {
        VoiceId: voice.Id,
        Text: text,
        TextType: isSSML ? 'ssml' : 'text',
        OutputFormat: 'mp3',
      },
      async (err, data) => {
        if (err) {
          return reject(err);
        }

        const cacheFilePath = `${cacheDir}/${TAG}_${uuid()}.mp3`;
        try {
          await promisify(fs.writeFile)(cacheFilePath, data.AudioStream);
          setCacheForAudio(text, opt, cacheFilePath);
          resolve(cacheFilePath);
        } catch (writeErr) {
          reject(writeErr);
        }
      },
    );
  });
}

module.exports = {
  getAudioFile,
};
