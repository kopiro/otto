import { Language } from "../types";

export abstract class Translator {
  abstract translate(text: string, toLanguage: Language, fromLanguage: Language): Promise<string>;
  abstract getLanguages(): Promise<Array<{ name: string; code: string }>>;
}
