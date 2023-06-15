import GCTTS from "@google-cloud/text-to-speech";
import config from "../../config";
import { Language } from "../../types";
import { google } from "@google-cloud/text-to-speech/build/protos/protos";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
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
    this.client = new GCTTS.TextToSpeechClient();
    this.conf = config().tts;
  }

  private cleanText(text: string) {
    // Removi all emojies
    return text.replace(/[\u{1F600}-\u{1F6FF}]/gu, "");
  }

  private async getVoice(language: Language) {
    const [response] = await this.client.listVoices({ languageCode: language });
    const availableVoices = response.voices?.filter((voice) => voice.ssmlGender === this.conf.gender.toUpperCase());

    if (!availableVoices?.[0]) {
      // Fallback to config().language
      return this.getCachedVoice(config().language);
    }

    logger.debug("Voice", availableVoices[0]);

    return availableVoices[0];
  }

  private async getCachedVoice(language: Language) {
    const key = language;
    if (!this.voices.has(key)) {
      const voice = await this.getVoice(language);
      this.voices.set(key, voice);
    }
    return this.voices.get(key);
  }

  /**
   * Download the audio file for that sentence and options
   */
  async getAudio(text: string, language: Language) {
    const cleanText = this.cleanText(text);

    // Find the voice title by options
    const voice = await this.getCachedVoice(language);

    // Call the API
    const [{ audioContent }] = await this.client.synthesizeSpeech({
      input: {
        [/<speak>/.test(cleanText) ? "ssml" : "text"]: cleanText,
      },
      voice: {
        ...voice,
        languageCode: voice.languageCodes[0],
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

  async getAudioFile(text: string, language: Language): Promise<File> {
    const data = await this.getAudio(text, language);
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
