const GCTTS = require("@google-cloud/text-to-speech");
const _ = require("underscore");
const md5 = require("md5");
const fs = require("fs");
const config = require("../config");
const { cacheDir } = require("../paths");
const { uuid } = require("../helpers");

const _config = config.gcloud.tts;
const TAG = "GCTTS";
const CACHE_REGISTRY_FILE = `${cacheDir}/${TAG}.json`;

// Creates a client

const client = new GCTTS.TextToSpeechClient();

let cache = {};

/**
 * Load the cache registry from file
 */
function loadCacheRegistry() {
  try {
    const registry = JSON.parse(
      fs.readFileSync(CACHE_REGISTRY_FILE).toString()
    );
    if (registry.audio == null || registry.voices == null) {
      throw new Error("Invalid registry format");
    }
    cache = registry;
  } catch (ex) {
    cache = {
      audio: {},
      voices: {}
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
  const key = md5(text + JSON.stringify(opt));
  cache.audio[key] = file;
  return fs.writeFileSync(CACHE_REGISTRY_FILE, JSON.stringify(cache));
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
async function getVoice({ language: languageCode, gender }) {
  const response = await client.listVoices({ languageCode });
  const { ssmlGender, name } = response[0].voices.filter(
    voice => voice.ssmlGender.toLowerCase() === gender.toLowerCase()
  )[0];
  return {
    languageCode,
    ssmlGender,
    name
  };
}

/**
 * Download the audio file for that sentence and options
 * @param {String} text Sentence
 * @param {Object} opt
 */
async function getAudioFile(text, opt = {}) {
  _.defaults(opt, {
    gender: _config.gender,
    language: config.language
  });

  if (text.length >= 5000) {
    console.warn(TAG, "truncating text to 5000 chars");
    text = text.substr(0, 5000);
  }

  // If file has been downloaded, just serve it
  const cachedFile = getCacheForAudio(text, opt);
  if (cachedFile) {
    return cachedFile;
  }

  // Find the voice title by options
  const voice = await getVoice(opt);

  const isSSML = /<speak>/.test(text);
  const input = { [isSSML ? "ssml" : "text"]: text };

  // Call the API
  const data = await client.synthesizeSpeech({
    input,
    voice,
    audioConfig: {
      audioEncoding: "MP3"
    }
  });

  const file = `${cacheDir}/${TAG}_${uuid()}.mp3`;
  fs.writeFileSync(file, data[0].audioContent, "binary");

  // Save this entry onto cache
  setCacheForAudio(text, opt, file);

  return file;
}

loadCacheRegistry();

module.exports = {
  getAudioFile
};
