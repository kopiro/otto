import md5 from "md5";
import fs from "fs";
import { promisify } from "util";
import { client as aws } from "./aws";
import config from "../config";
import { cacheDir } from "../paths";
import { getLocaleFromLanguageCode } from "../helpers";
import { Voice } from "aws-sdk/clients/polly";
import { v4 as uuid } from "uuid";

const TAG = "Polly";

const CACHE_REGISTRY_FILE = `${cacheDir}/${TAG}.json`;

const client = new aws.Polly({
  signatureVersion: "v4",
  region: "eu-west-1",
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
 */
async function setCacheForVoice(language: string, gender: string, voice: Voice) {
  getCacheRegistry().voices[md5(language + gender)] = voice;
  return saveCacheRegistry();
}

/**
 * Get the cache for a voice
 */
function getCacheForVoice(opt: any) {
  return getCacheRegistry().voices[JSON.stringify(opt)];
}

/**
 * Set the cache item for the audio
 */
async function setCacheForAudio(text: string, language: string, gender: string, file: string) {
  const key = md5(text + language + gender);
  getCacheRegistry().audio[key] = file;
  return saveCacheRegistry();
}

/**
 * Get the cache item for an audio
 */
function getCacheForAudio(text: string, language: string, gender: string) {
  const key = md5(text + language + gender);
  const file = getCacheRegistry().audio[key];
  if (file != null && fs.existsSync(file)) {
    return file;
  }
  return null;
}

/**
 * Retrieve the voice title based on language and gender
 */
function getVoice(language: string, gender: string): Promise<Voice> {
  return new Promise((resolve, reject) => {
    const locale = getLocaleFromLanguageCode(language);
    let voice = getCacheForVoice({ language, gender });
    if (voice) {
      return resolve(voice);
    }

    // Call the API to retrieve all voices in that locale
    return client.describeVoices(
      {
        LanguageCode: locale,
      },
      async (err, data) => {
        if (err != null) {
          return reject(err);
        }

        // Filter voice by selected gender
        voice = data.Voices.find(v => v.Gender === gender);

        if (voice == null) {
          console.debug(TAG, `falling back to language ${config().language} instead of ${language}`);
          voice = await getVoice(config().language, gender);
          return resolve(voice);
        }

        // Save for later uses
        setCacheForVoice(language, gender, voice);
        return resolve(voice);
      },
    );
  });
}

/**
 * Download the audio file for that sentence and options
 */
export function getAudioFile(text: string, language: string, gender: string) {
  return new Promise(async (resolve, reject) => {
    // If file has been downloaded, just serve it
    const file = getCacheForAudio(text, language, gender);
    if (file) {
      return resolve(file);
    }

    // Find the voice title by options
    const voice = await getVoice(language, gender);
    const isSSML = /<speak>/.test(text);

    // TODO: split by text length so that Polly can process

    // Call the API
    return client.synthesizeSpeech(
      {
        VoiceId: voice.Id,
        Text: text,
        TextType: isSSML ? "ssml" : "text",
        OutputFormat: "mp3",
      },
      async (err, data) => {
        if (err) {
          return reject(err);
        }

        const cacheFilePath = `${cacheDir}/${TAG}_${uuid()}.mp3`;
        try {
          await promisify(fs.writeFile)(cacheFilePath, data.AudioStream);
          setCacheForAudio(text, language, gender, cacheFilePath);
          return resolve(cacheFilePath);
        } catch (writeErr) {
          return reject(writeErr);
        }
      },
    );
  });
}
