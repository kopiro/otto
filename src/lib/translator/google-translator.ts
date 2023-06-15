import { v2 } from "@google-cloud/translate";
import { Language } from "../../types";
import { ITranslator } from "../../stdlib/translator";

export class GoogleTranslator implements ITranslator {
  client: v2.Translate;
  _languages?: v2.LanguageResult[];

  constructor() {
    this.client = new v2.Translate();
  }

  async translate(text: string, language: Language): Promise<string> {
    const [translations] = await this.client.translate(text, language);
    return Array.isArray(translations) ? translations[0] : translations;
  }

  async getLanguages(): Promise<Array<{ name: string; code: string }>> {
    if (!this._languages) {
      const [languages] = await this.client.getLanguages("en");
      this._languages = languages;
    }
    return this._languages;
  }

  async getFullnameForLanguage(target: Language): Promise<string | undefined> {
    const languages = await this.getLanguages();
    return languages.find((e) => e.code === target)?.name;
  }
}
