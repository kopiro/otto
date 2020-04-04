import gcloudTranslate from "@google-cloud/translate";

export function translate(text: string, toLanguage: string, fromLanguage: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (toLanguage === fromLanguage) {
      resolve(text);
    } else {
      gcloudTranslate.translate(text, toLanguage, (err, translation) => {
        err ? reject(err) : resolve(translation as string);
      });
    }
  });
}

export function getLanguages(target: string): Promise<Array<{ name: string; code: string }>> {
  return new Promise((resolve, reject) => {
    gcloudTranslate.getLanguages(target, (err, languages) => {
      err ? reject(err) : resolve(languages);
    });
  });
}
