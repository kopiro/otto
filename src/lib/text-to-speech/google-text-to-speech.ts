import config from "../../config";
import { Gender, Language } from "../../types";
import { google } from "@google-cloud/text-to-speech/build/protos/protos";
import { v1beta1 } from "@google-cloud/text-to-speech";
import { TextToSpeechClient } from "@google-cloud/text-to-speech/build/src/v1beta1";
import { writeFile } from "fs/promises";
import { File } from "../../stdlib/file";
import { ITextToSpeech } from "../../stdlib/text-to-speech";

import { Signale } from "signale";

const TAG = "GoogleTextToSpeech";
const logger = new Signale({
  scope: TAG,
});

export class GoogleTextToSpeech implements ITextToSpeech {
  private client: TextToSpeechClient;
  private voices: Map<string, google.cloud.texttospeech.v1.IVoice> = new Map();

  private conf: {
    gender: string;
    encoding: string;
  };

  constructor() {
    this.client = new v1beta1.TextToSpeechClient();
    this.conf = config().tts;
  }

  private cleanText(text: string) {
    return (
      text
        // Removi all emojies
        .replace(
          /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
          "",
        )
        // Remove "*"
        .replace(/\*/g, "")
        // Remove _
        .replace(/_/g, "")
        // Replace "\n" with "."
        .replace("\n", ".")
    );
  }

  private async getVoice(language: Language, gender: Gender): Promise<google.cloud.texttospeech.v1beta1.IVoice> {
    const [response] = await this.client.listVoices({ languageCode: language });
    const availableVoices = response.voices?.filter((voice) => voice.ssmlGender === gender.toUpperCase());

    if (!availableVoices?.[0]) {
      logger.warn(`The language <${language}> is not available, using default voice`);
      return this.getCachedVoice("en-US", "female");
    }

    const voice = availableVoices[0];
    if (!voice) {
      throw new Error(`Unable to get a voice with language = ${language} and gender = ${gender}`);
    }

    logger.info(`Voice used`, voice);

    return voice;
  }

  private async getCachedVoice(language: Language, gender: Gender): Promise<google.cloud.texttospeech.v1.IVoice> {
    const key = JSON.stringify({ language, gender });
    if (!this.voices.has(key)) {
      const voice = await this.getVoice(language, gender);
      this.voices.set(key, voice);
      return voice;
    }

    const cachedVoice = this.voices.get(key);
    if (!cachedVoice) {
      throw new Error("Failed to get cached voice");
    }

    return cachedVoice;
  }

  /**
   * Download the audio file for that sentence and options
   */
  async getAudio(text: string, language: Language, gender: Gender) {
    const cleanText = this.cleanText(text);

    // Find the voice title by options
    const voice = await this.getCachedVoice(language, gender);

    // Call the API
    const [{ audioContent }] = await this.client.synthesizeSpeech({
      input: {
        [/<speak>/.test(cleanText) ? "ssml" : "text"]: cleanText,
      },
      voice: {
        ...voice,
        languageCode: voice.languageCodes?.[0] || language,
      },
      audioConfig: {
        audioEncoding: this.conf.encoding as unknown as google.cloud.texttospeech.v1.AudioEncoding,
      },
    });
    if (!audioContent) {
      throw new Error("Failed to get audio content");
    }

    return audioContent;
  }

  async getAudioFile(text: string, language: Language, gender: Gender): Promise<File> {
    const data = await this.getAudio(text, language, gender);
    if (!data) {
      throw new Error("Failed to get audio file");
    }

    const file = File.getTmpFile(this.conf.encoding.toLowerCase());
    await writeFile(file.getAbsolutePath(), data, {
      encoding: "binary",
    });

    return file;
  }
}
