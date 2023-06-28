import config from "../../config";
import { Language } from "../../types";
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
    // Removi all emojies
    return text.replace(
      /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
      "",
    );
  }

  private async getVoice(language: Language) {
    const [response] = await this.client.listVoices({ languageCode: language });
    const availableVoices = response.voices?.filter((voice) => voice.ssmlGender === this.conf.gender.toUpperCase());

    if (!availableVoices?.[0]) {
      logger.warn(`The language <${language}> is not available, using ${config().language} instead`);
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
