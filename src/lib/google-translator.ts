import { v2 } from "@google-cloud/translate";
import { Language } from "../types";
import { Translator } from "../abstracts/translator";
import config from "../config";

export class GoogleTranslator extends Translator {
  client: v2.Translate;
  languages: v2.LanguageResult[] | null;

  constructor() {
    super();
    this.client = new v2.Translate();
  }

  async translate(text: string, toLanguage: Language, fromLanguage: Language): Promise<string> {
    if (toLanguage === fromLanguage) {
      return text;
    }
    const [translations] = await this.client.translate(text, toLanguage);
    return Array.isArray(translations) ? translations[0] : translations;
  }

  async getLanguages(): Promise<Array<{ name: string; code: string }>> {
    if (!this.languages) {
      const [languages] = await this.client.getLanguages("en");
      this.languages = languages;
    }
    return this.languages;
  }

  async getFullnameForLanguage(target: Language): Promise<string> {
    const languages = await this.getLanguages();
    return languages.find((e) => e.code === target)?.name;
  }
}
