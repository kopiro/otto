import fs from "fs";
import { Language } from "../types";

export type SpeechRecognizerDriver = "google" | "polly";

export abstract class SpeechRecognizer {
  SAMPLE_RATE;
  abstract async recognizeStream(stream: fs.ReadStream, language: string): Promise<string>;
  abstract async recognizeFile(
    file: string,
    language: Language,
    convertFile: boolean,
    overrideFileWhenConvert: boolean,
  ): Promise<string>;
  abstract async createRecognizeStream(
    language: Language,
    callback: (err: any, text?: string) => void,
    interimResults?,
    singleUtterance?,
  );
}
