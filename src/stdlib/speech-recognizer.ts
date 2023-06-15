import config from "../config";
import { GoogleSpeechRecognizer } from "../lib/speech-recognizer/google-speech-recognizer";
import fs from "fs";
import { Language } from "../types";
import Pumpify from "pumpify";

export interface ISpeechRecognizer {
  SAMPLE_RATE: number;
  recognizeStream(stream: fs.ReadStream, language: string, audioConfig?: any): Promise<string>;
  recognizeFile(file: string, language: Language, audioConfig?: any): Promise<string>;
  createRecognizeStream(language: Language, callback: (err: any, text?: string) => void, audioConfig?: any): Pumpify;
}

export class SpeechRecognizer {
  private static instance: ISpeechRecognizer;
  static getInstance(): ISpeechRecognizer {
    if (!SpeechRecognizer.instance) {
      const driverName = config().speechRecognizerDriver;
      switch (driverName) {
        case "google":
          SpeechRecognizer.instance = new GoogleSpeechRecognizer();
          break;
        default:
          throw new Error(`Invalid speech recognizer: <${driverName}>`);
      }
    }
    return SpeechRecognizer.instance;
  }
}
