import fs from "fs";
import { Language } from "../types";

export type SpeechRecognizerDriver = "google" | "polly";

export abstract class SpeechRecognizer {
  SAMPLE_RATE;
  abstract async recognizeStream(stream: fs.ReadStream, language: string, audioConfig?: any): Promise<string>;
  abstract async recognizeFile(file: string, language: Language, audioConfig?: any): Promise<string>;
  abstract async createRecognizeStream(
    language: Language,
    callback: (err: any, text?: string) => void,
    audioConfig?: any,
  );
}
