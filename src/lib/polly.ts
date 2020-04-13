import { client as aws } from "./aws";
import config from "../config";
import { getLocaleFromLanguageCode } from "../helpers";
import Polly, { Voice } from "aws-sdk/clients/polly";
import { TextToSpeech } from "../abstracts/text-to-speech";
import { Language, Gender } from "../types";

export class PollyTextToSpeech extends TextToSpeech {
  client: Polly;

  constructor() {
    super();
    this.client = new aws.Polly({
      signatureVersion: "v4",
      region: "eu-west-1",
    });
  }

  /**
   * Retrieve the voice title based on language and gender
   */
  _getVoice(language: Language, gender: Gender): Promise<Voice> {
    return new Promise((resolve, reject) => {
      const locale = getLocaleFromLanguageCode(language);

      // Call the API to retrieve all voices in that locale
      return this.client.describeVoices(
        {
          LanguageCode: locale,
        },
        async (err, data) => {
          if (err != null) {
            return reject(err);
          }

          // Filter voice by selected gender
          let voice = data.Voices.find((v) => v.Gender === gender);
          if (!voice) {
            voice = await this.getVoice(config().language, gender);
            return resolve(voice);
          }

          // Save for later uses
          return resolve(voice);
        },
      );
    });
  }

  /**
   * Download the audio file for that sentence and options
   */
  _getAudioFile(text: string, language: Language, gender: Gender) {
    return new Promise(async (resolve, reject) => {
      // Find the voice title by options
      const voice = await this.getVoice(language, gender);
      const isSSML = /<speak>/.test(text);

      // Call the API
      return this.client.synthesizeSpeech(
        {
          VoiceId: voice.Id,
          Text: text,
          TextType: isSSML ? "ssml" : "text",
          OutputFormat: config().audio.encoding,
        },
        async (err, data) => {
          if (err) {
            return reject(err);
          }

          return resolve(data.AudioStream);
        },
      );
    });
  }
}
