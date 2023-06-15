import config from "../config";
import { GoogleTranslator } from "../lib/translator/google-translator";
import { Language } from "../types";

export interface ITranslator {
  translate(text: string, language: Language): Promise<string>;
  getLanguages(): Promise<Array<{ name: string; code: string }>>;
}

export class Translator {
  private static instance: ITranslator;
  public static getInstance(): ITranslator {
    if (!Translator.instance) {
      const driverName = config().translatorDriver;
      switch (driverName) {
        case "google":
          Translator.instance = new GoogleTranslator();
          break;
        default:
          throw new Error(`Invalid translator: <${driverName}>`);
      }
    }
    return Translator.instance;
  }
}
