import config from "../config";
import { GoogleTextToSpeech } from "../lib/text-to-speech/google-text-to-speech";
import { Language } from "../types";
import { File } from "./file";

export interface ITextToSpeech {
  getAudioFile(text: string, language: Language): Promise<File>;
}

export class TextToSpeech {
  private static instance: ITextToSpeech;
  static getInstance(): ITextToSpeech {
    if (!TextToSpeech.instance) {
      const driverName = config().textToSpeechDriver;
      switch (driverName) {
        case "google":
          TextToSpeech.instance = new GoogleTextToSpeech();
          break;
        default:
          throw new Error(`Invalid TextToSpeech driver: <${driverName}>`);
      }
    }
    return TextToSpeech.instance;
  }
}
