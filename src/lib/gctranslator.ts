import { v2 } from "@google-cloud/translate";
const client = new v2.Translate();

export async function translate(text: string, toLanguage: string, fromLanguage: string): Promise<string> {
  if (toLanguage === fromLanguage) {
    return text;
  }
  const [translations] = await client.translate(text, toLanguage);
  return Array.isArray(translations) ? translations[0] : translations;
}

export async function getLanguages(target: string): Promise<Array<{ name: string; code: string }>> {
  return client.getLanguages(target);
}
