import GCTTS from "@google-cloud/text-to-speech";
import md5 from "md5";
import fs from "fs";
import config from "../config";
import { cacheDir } from "../paths";
import { v4 as uuid } from "uuid";
import { Language, Gender } from "../types";

const TAG = "GCTTS";
const CACHE_REGISTRY_FILE = `${cacheDir}/${TAG}.json`;

// Creates a client

const client = new GCTTS.TextToSpeechClient();

let cache: {
  audio: Record<string, string>;
  voices: Record<string, string>;
} = null;

const voices = {};

/**
 * Load the cache registry from file
 */
function loadCacheRegistry() {
  try {
    const registry = JSON.parse(fs.readFileSync(CACHE_REGISTRY_FILE).toString());
    if (registry.audio == null || registry.voices == null) {
      throw new Error("Invalid registry format");
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
 */
async function setCacheForAudio(text: string, language: Language, gender: Gender, file: string) {
  const key = md5(text + language + gender);
  cache.audio[key] = file;
  return fs.writeFileSync(CACHE_REGISTRY_FILE, JSON.stringify(cache));
}

/**
 * Get the cache item for an audio
 */
function getCacheForAudio(text: string, language: Language, gender: Gender): string | null {
  const key = md5(text + language + gender);
  const file = cache.audio[key];
  if (file != null && fs.existsSync(file)) {
    return file;
  }
  return null;
}

/**
 * Retrieve the voice title based on language and gender
 */
async function getVoice(language: Language, gender: Gender) {
  const cacheKey = md5(language + gender);

  if (voices[cacheKey]) {
    return voices[cacheKey];
  }

  const response = await client.listVoices({ languageCode: language });
  const availableVoices = response[0].filter(voice => voice.ssmlGender.toLowerCase() === gender.toLowerCase());

  if (availableVoices.length > 0) {
    const { ssmlGender, name } = availableVoices[0];
    voices[cacheKey] = {
      language,
      ssmlGender,
      name,
    };
    return voices[cacheKey];
  }

  // Fallback to config().language
  return getVoice(config().language, gender);
}

/**
 * Download the audio file for that sentence and options
 */
export async function getAudioFile(text: string, language: Language, gender: Gender) {
  // If file has been downloaded, just serve it
  const cachedFile = getCacheForAudio(text, language, gender);
  if (cachedFile) {
    return cachedFile;
  }

  // Find the voice title by options
  const voice = await getVoice(language, gender);

  const isSSML = /<speak>/.test(text);
  const input = null;
  isSSML ? (input.ssml = text) : (input.text = text);

  // Call the API
  const data = await client.synthesizeSpeech({
    input,
    voice,
    audioConfig: {
      audioEncoding: "MP3",
    },
  });

  const file = `${cacheDir}/${TAG}_${uuid()}.mp3`;
  fs.writeFileSync(file, data[0].audioContent, "binary");

  // Save this entry onto cache
  setCacheForAudio(text, language, gender, file);

  return file;
}

loadCacheRegistry();
