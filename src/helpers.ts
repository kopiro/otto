import { remove as diacriticsRemove } from "diacritics";
import request from "request";
import fs from "fs";
import path from "path";
import config from "./config";
import translator from "./stdlib/translator";
import { cacheDir, tmpDir } from "./paths";
import { Language, Locale, Session } from "./types";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import { Signale } from "signale";

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
  const console = new Signale({
    scope: TAG,
  });

  return new Promise((resolve, reject) => {
    if (!uri) {
      return reject("Invalid URI/Buffer");
    }

    const hash = crypto.createHash("md5").update(uri).digest("hex");
    const localFile = path.join(cacheDir, `${hash}.${extension}`);

    if (Buffer.isBuffer(uri)) {
      if (!fs.existsSync(localFile)) {
        console.debug(`writing buffer to local file <${localFile}>`);
        return fs.promises.writeFile(localFile, uri).then(() => {
          resolve(localFile);
        });
      }
      return resolve(localFile);
    }

    if (typeof uri === "string" && /^https?:\/\//.test(uri)) {
      if (!fs.existsSync(localFile)) {
        console.debug(`writing ${uri} to local file <${localFile}>`);
        return request(uri, {
          followAllRedirects: true,
        })
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
 * Replace any %var% into a string literal with provided data as second arg
 */
export function replaceVariablesInStrings(text: string, data: Record<string, string>): string {
  let reLoop = null;
  let textCopy = text;
  const re = /%(\w+)%/g;
  // eslint-disable-next-line no-cond-assign
  while ((reLoop = re.exec(text))) {
    const inVar = reLoop[1];
    if (data[inVar]) {
      textCopy = textCopy.replace(`%${inVar}%`, data[inVar] || "");
    }
  }
  return textCopy;
}

export async function getLanguageNameFromLanguageCode(languageCode: string): Promise<Language> {
  const languages = await translator().getLanguages();
  return languages.find((e) => e.code === languageCode)?.name;
}

export async function getLanguageCodeFromLanguageName(languageName: string): Promise<Language> {
  const languages = await translator().getLanguages();
  return languages.find((e) => e.name === languageName)?.code;
}

export function tryCatch<T>(callable: () => T, defaultValue: any): T | typeof defaultValue {
  try {
    return callable();
  } catch (error) {
    console.log("Catched to default error", error);
    return defaultValue;
  }
}

export function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
}

export function isJsonString(str: string): boolean {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

export function getSessionTranslateFrom(session: Session): Language {
  return session.translateFrom || config().language;
}

export function getSessionTranslateTo(session: Session): Language {
  return session.translateTo || config().language;
}

export function getSessionName(session: Session): string {
  if (session.name) {
    return session.name;
  }

  if (session.ioDriver === "telegram") {
    const { first_name, last_name } = session.ioData.from;
    if (first_name && last_name) {
      return `${first_name} ${last_name}`;
    }
    if (first_name) {
      return first_name;
    }
  }

  return "Anonymous";
}

export function getSessionLocaleTimeString(session: Session): string {
  const date = new Date();
  return date.toLocaleTimeString(session.translateTo, { timeZone: session.timeZone || "UTC" });
}
