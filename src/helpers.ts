import { remove as diacriticsRemove } from "diacritics";
import request from "request";
import fs from "fs";
import path from "path";
import config from "./config";
import Translator from "./stdlib/translator";
import { cacheDir, tmpDir } from "./paths";
import { Language, Locale } from "./types";
import { v4 as uuid } from "uuid";
import crypto from "crypto";

export function getTmpFile(extension: string) {
  return path.join(tmpDir, `${uuid()}.${extension}`);
}

/**
 * Pick a random element in an array
 */
export function rand<T>(e: Array<T> | T): T {
  return Array.isArray(e) ? e[Math.floor(Math.random() * (e.length - 1))] : e;
}

/**
 * Timeout using promises
 */
export function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clean text by removing diacritics and lowering its case
 */
export function normalizeTextForKeyword(t: string): string {
  return diacriticsRemove(t).toLowerCase();
}

/**
 * Get the locale string from a language
 */
export function getLocaleFromLanguageCode(language: Language): Locale {
  switch (language) {
    case "de":
      return "de-DE";
    case "da":
      return "da-DK";
    case "it":
      return "it-IT";
    case "is":
      return "is-IS";
    case "fr":
      return "fr-FR";
    case "es":
      return "es-ES";
    case "tr":
      return "tr-TR";
    case "ru":
      return "ru-RU";
    case "ro":
      return "ro-RO";
    case "en":
      return "en-GB";
    case "ja":
      return "ja-JP";
    case "cy":
      return "cy-GB";
    case "pt":
      return "pt-PT";
    case "nl":
      return "nl-NL";
    case "nb":
      return "nb-NO";
    case "sv":
      return "sv-SE";
  }
}

/**
 * Get the local URI of a remote object by downloading it
 */
export function getLocalObjectFromURI(uri: string | Buffer, extension: string): Promise<string> {
  const TAG = "getLocalObjectFromURI";

  return new Promise((resolve, reject) => {
    if (!uri) {
      return reject("Invalid URI/Buffer");
    }

    const hash = crypto.createHash("md5").update(uri).digest("hex");
    const localFile = path.join(cacheDir, `${hash}${extension}`);

    if (Buffer.isBuffer(uri)) {
      if (!fs.existsSync(localFile)) {
        console.debug(TAG, `writing buffer to local file <${localFile}>`);
        return fs.promises.writeFile(localFile, uri).then(() => {
          resolve(localFile);
        });
      }
      return resolve(localFile);
    }

    if (typeof uri === "string" && /^https?:\/\//.test(uri)) {
      if (!fs.existsSync(localFile)) {
        console.debug(TAG, `writing ${uri} to local file <${localFile}>`);
        return request(uri)
          .pipe(fs.createWriteStream(localFile))
          .on("close", () => {
            resolve(localFile);
          });
      }
      return resolve(localFile);
    }

    return resolve(uri as string);
  });
}

/**
 * Extract a pattern from a string
 */
export function extractWithPattern(input: any, pattern: string): any {
  if (input == null) return null;
  if (pattern == "") return input;

  const p = pattern.split(".");
  let _p = p.shift();

  // Array search
  if (_p === "[]") {
    _p = p.shift();
    for (const _input of input) {
      if (_input[_p] != null) {
        const found = extractWithPattern(_input[_p], p.join("."));
        if (found) return found;
      }
    }
    return null;
  }

  if (p.length === 0) {
    return input[_p];
  }

  return extractWithPattern(input[_p], p.join("."));
}

/**
 * Get the current bot name as Regexp
 */
export function getAiNameRegex(): RegExp {
  return new RegExp(config().aiNameRegex, "gi");
}

/**
 * Replace any %var% into a string literal with provided data as second arg
 */
export function replaceVariablesInStrings(text: string, data: Record<string, string>): string {
  let reLoop = null;
  let textCopy = text;
  const re = /\%(\w+)\%/g;
  // eslint-disable-next-line no-cond-assign
  while ((reLoop = re.exec(text))) {
    const inVar = reLoop[1];
    if (data[inVar]) {
      textCopy = textCopy.replace(`%${inVar}%`, data[inVar] || "");
    }
  }
  return textCopy;
}

export async function getLanguageCodeFromLanguageLongString(languageLongString: string): Promise<Language> {
  const languages = await Translator.getLanguages(config().language);
  return languages.find((e) => e.name === languageLongString)?.code;
}

export function tryCatch<T>(callable: () => T, defaultValue: any): T | typeof defaultValue {
  try {
    return callable();
  } catch (error) {
    console.log("Catched to default error", error);
    return defaultValue;
  }
}
