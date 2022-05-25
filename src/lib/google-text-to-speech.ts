import GCTTS from "@google-cloud/text-to-speech";
import config from "../config";
import { Language, Gender } from "../types";
import { google } from "@google-cloud/text-to-speech/build/protos/protos";
import { TextToSpeech } from "../abstracts/text-to-speech";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";

export class GoogleTextToSpeech extends TextToSpeech {
  client: TextToSpeechClient;

  constructor() {
    super();
    this.client = new GCTTS.TextToSpeechClient();
  }

  getVoice(language: Language, gender: Gender) {
    const key = this.getCacheKeyForVoice(language, gender);
    if (this.cache.voices[key]) {
      return this.cache.voices[key];
    }

    const voice = this._getVoice(language, gender);
    this.cache.voices[key] = voice;
    return voice;
  }

  /**
   * Retrieve the voice title based on language and gender
   */
  async _getVoice(language: Language, gender: Gender) {
    const [response] = await this.client.listVoices({ languageCode: language });
    const availableVoices = response.voices?.filter((voice) => voice.ssmlGender === gender.toUpperCase());

    if (availableVoices?.[0]) {
      const { ssmlGender, name } = availableVoices[0];
      const voice = {
        languageCode: language,
        ssmlGender,
        name,
      };
      this.setCacheForVoice(language, gender, voice);
      return voice;
    }

    // Fallback to config().language
    return this.getVoice(config().language, gender);
  }

  /**
   * Download the audio file for that sentence and options
   */
  async _getAudioFile(text: string, language: Language, gender: Gender) {
    // Find the voice title by options
    const voice = await this.getVoice(language, gender);

    // Call the API
    const [{ audioContent }] = await this.client.synthesizeSpeech({
      input: {
        [/<speak>/.test(text) ? "ssml" : "text"]: text,
      },
      voice,
      audioConfig: {
        audioEncoding: (config().audio.encoding as unknown) as google.cloud.texttospeech.v1.AudioEncoding,
      },
    });
    return audioContent;
  }
}
