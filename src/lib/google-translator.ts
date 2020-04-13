import { v2 } from "@google-cloud/translate";
import { Language } from "../types";
import { Translator } from "../abstracts/translator";

export class GoogleTranslator extends Translator {
  client: v2.Translate;

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

  async getLanguages(target: Language): Promise<Array<{ name: string; code: string }>> {
    const [languages] = await this.client.getLanguages(target);
    return languages;
  }
}
