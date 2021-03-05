import { Language } from "../types";

export abstract class Translator {
  abstract translate(text: string, toLanguage: Language, fromLanguage: Language): Promise<string>;
  abstract getLanguages(target: string): Promise<Array<{ name: string; code: string }>>;
}
