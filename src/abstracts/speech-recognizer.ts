import fs from "fs";
import { Language } from "../types";
import Pumpify from "pumpify";
export abstract class SpeechRecognizer {
  abstract SAMPLE_RATE: number;
  abstract recognizeStream(stream: fs.ReadStream, language: string, audioConfig?: any): Promise<string>;
  abstract recognizeFile(file: string, language: Language, audioConfig?: any): Promise<string>;
  abstract createRecognizeStream(
    language: Language,
    callback: (err: any, text?: string) => void,
    audioConfig?: any,
  ): Pumpify;
}
