import { Language } from "../types";

export abstract class Translator {
  abstract async translate(text: string, toLanguage: Language, fromLanguage: Language): Promise<string>;
  abstract async getLanguages(target: string): Promise<Array<{ name: string; code: string }>>;
}
