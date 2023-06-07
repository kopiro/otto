import { v2 } from "@google-cloud/translate";
import { Language } from "../../types";
import { Translator } from "../../abstracts/translator";
import config from "../../config";

export class GoogleTranslator extends Translator {
  client: v2.Translate;
  _languages?: v2.LanguageResult[];

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
