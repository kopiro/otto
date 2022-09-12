import fs from "fs";
import { Language, Gender } from "../types";
import { cacheDir } from "../paths";
import { v4 as uuid } from "uuid";
import crypto from "crypto";

export type TextToSpeechDriver = "google" | "polly";

export abstract class TextToSpeech {
  cache: {
    audio: Record<string, string>;
    voices: Record<string, string>;
  };
  TAG = "tts";
  CACHE_REGISTRY_FILE = `${cacheDir}/${this.TAG}.json`;

  constructor() {
    this.cache = {
      audio: {},
      voices: {},
    };
    this.loadCacheRegistry();
  }

  loadCacheRegistry() {
    try {
      this.cache = JSON.parse(fs.readFileSync(this.CACHE_REGISTRY_FILE).toString());
    } catch (ex) {}
  }

  writeCacheRegistry() {
    return fs.writeFileSync(this.CACHE_REGISTRY_FILE, JSON.stringify(this.cache, null, 2));
  }

  getCacheKeyForVoice(language: Language, gender: Gender) {
    return `${String(language)}$${String(gender)}`;
  }

  abstract _getVoice(language: Language, gender: Gender);

  getVoice(language: Language, gender: Gender) {
    const key = this.getCacheKeyForVoice(language, gender);
    if (this.cache.voices[key]) {
      return this.cache.voices[key];
    }

    const voice = this._getVoice(language, gender);
    this.cache.voices[key] = voice;
    return voice;
  }

  setCacheForVoice(language: Language, gender: Gender, voice: any) {
    const key = this.getCacheKeyForVoice(language, gender);
    this.cache.voices[key] = voice;
    this.writeCacheRegistry();
  }

  abstract _getAudioFile(text: string, language: Language, gender: Gender): Promise<crypto.BinaryLike | undefined>;

  async getAudioFile(text: string, language: Language, gender: Gender) {
    // If file has been downloaded, just serve it
    const cachedFile = this.getCacheForAudio(text, language, gender);
    if (cachedFile) {
      return cachedFile;
    }
    const data = await this._getAudioFile(text, language, gender);
    if (!data) return null;

    const file = `${cacheDir}/${this.TAG}_${uuid()}.mp3`;
    fs.writeFileSync(file, data, "binary");

    // Save this entry onto cache
    this.setCacheForAudio(text, language, gender, file);

    return file;
  }

  getCacheKeyForAudio(text: string, language: Language, gender: Gender) {
    const e = [text, language, gender].filter((e) => e).join();
    return crypto.createHash("md5").update(e).digest("hex");
  }

  /**
   * Get the cache item for an audio
   */
  getCacheForAudio(text: string, language: Language, gender: Gender): string | null {
    const key = this.getCacheKeyForAudio(text, language, gender);
    const file = this.cache.audio[key];
    if (file != null && fs.existsSync(file)) {
      return file;
    }
    return null;
  }

  /**
   * Set the cache item for the audio
   */
  setCacheForAudio(text: string, language: Language, gender: Gender, file: string) {
    const key = this.getCacheKeyForAudio(text, language, gender);
    this.cache.audio[key] = file;
    this.writeCacheRegistry();
  }
}
