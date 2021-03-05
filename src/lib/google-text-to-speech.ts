import GCTTS from "@google-cloud/text-to-speech";
import config from "../config";
import { Language, Gender } from "../types";
import { google } from "@google-cloud/text-to-speech/build/protos/protos";
import { TextToSpeech } from "../abstracts/text-to-speech";
import { TextToSpeechClient } from "@google-cloud/text-to-speech/build/src/v1";

export class GoogleTextToSpeech extends TextToSpeech {
  client: TextToSpeechClient;

  constructor() {
    super();
    this.client = new GCTTS.TextToSpeechClient();
  }

  /**
   * Retrieve the voice title based on language and gender
   */
  async _getVoice(language: Language, gender: Gender) {
    const response = await this.client.listVoices({ languageCode: language });
    const availableVoices = response[0].voices.filter((voice) => voice.ssmlGender === gender.toUpperCase());

    if (availableVoices.length > 0) {
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

    const isSSML = /<speak>/.test(text);
    const input: any = {};
    isSSML ? (input.ssml = text) : (input.text = text);

    // Call the API
    const [data] = await this.client.synthesizeSpeech({
      input,
      voice,
      audioConfig: {
        audioEncoding: (config().audio.encoding as unknown) as google.cloud.texttospeech.v1.AudioEncoding,
      },
    });
    return data.audioContent;
  }
}
