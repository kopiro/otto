import { existsSync } from "fs";
import path from "path";
import config from "./config";
import { cacheDir, logsDir } from "./paths";
import { Authorization, IErrorWithData } from "./types";
import crypto, { createHash } from "crypto";
import { File } from "./stdlib/file";

import { Signale } from "signale";
import { writeFile } from "fs/promises";
import fetch from "node-fetch";
import { AuthorizationError } from "./errors/authorization-error";
import { IOManager } from "./stdlib/io-manager";
import { IOChannel } from "./data/io-channel";
import { Person } from "./data/person";

const TAG = "Helpers";
const logger = new Signale({
  scope: TAG,
});

/**
 * Get the name of the AI
 */
export function getAINameRegexp(): RegExp {
  // Add boundaries to the name
  return new RegExp(`\\b${config().aiName}\\b`, "im");
}

/**
 * Chunk an array into array of size
 */
export function chunkArray(array: number[], size: number) {
  return Array.from({ length: Math.ceil(array.length / size) }, (v, index) =>
    array.slice(index * size, index * size + size),
  );
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
 * Get the local URI of a remote object by downloading it
 */
export async function getLocalObjectFromURI(uri: string | Buffer | File, extension: string): Promise<File> {
  if (uri instanceof File) {
    return uri;
  }

  if (Buffer.isBuffer(uri)) {
    const hash = crypto.createHash("md5").update(uri).digest("hex");
    const localFile = new File(path.join(cacheDir, `${hash}.${extension}`));

    if (!existsSync(localFile.getAbsolutePath())) {
      await writeFile(localFile.getAbsolutePath(), uri);
    }

    return localFile;
  }

  if (typeof uri === "string" && /^https?:\/\//.test(uri)) {
    const hash = crypto.createHash("md5").update(uri).digest("hex");
    const localFile = new File(path.join(cacheDir, `${hash}.${extension}`));

    if (!existsSync(localFile.getAbsolutePath())) {
      const response = await fetch(uri);
      const buffer = await response.buffer();
      await writeFile(localFile.getAbsolutePath(), buffer);
    }

    return localFile;
  }

  if (typeof uri === "string" && existsSync(uri)) {
    return new File(uri);
  }

  throw new Error(`Cannot get local object from URI ${uri}`);
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

export function tryJsonParse<T>(value: string | undefined, defaultValue: T): T {
  try {
    return value !== undefined ? JSON.parse(value) : defaultValue;
  } catch (error) {
    logger.debug(`Unable to parse JSON <${value}>, returning default value <${defaultValue}>`);
    return defaultValue;
  }
}

export function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

export function isJsonString(str: string): boolean {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

export function ensureError(value: unknown): Error {
  if (value instanceof Error) return value;

  let stringified = "[Unable to stringify the thrown value]";
  try {
    stringified = JSON.stringify(value);
  } catch {
    logger.error(`Unable to stringify the thrown value: ${value}`);
  }

  const error = new Error(`This value was thrown as is, not through an Error: ${stringified}`);
  return error;
}

export function throwIfMissingAuthorizations(
  authorizations: Authorization[] = [],
  requiredAuthorizations: Authorization[],
): void {
  authorizations = authorizations || [];
  requiredAuthorizations = requiredAuthorizations || [];

  if (authorizations.includes(Authorization.ADMIN)) {
    return;
  }

  for (const requiredAuth of requiredAuthorizations) {
    if (!authorizations.includes(requiredAuth)) {
      throw new AuthorizationError(requiredAuth);
    }
  }
}

export async function report(error: IErrorWithData) {
  logger.fatal(`Reporting`, error);

  const { personId, ioChannelId } = config().reports;
  const ioChannel = await IOChannel.findByIdOrThrow(ioChannelId);
  const person = await Person.findByIdOrThrow(personId);

  await IOManager.getInstance().output({ error }, ioChannel, person, null, true);
}

export async function logStacktrace(fileName: string, response: any) {
  return writeFile(path.join(logsDir, fileName), JSON.stringify(response, null, 2));
}
