import speech from "@google-cloud/speech";
import fs from "fs";
import * as Proc from "./proc";
import { getLocaleFromLanguageCode } from "../helpers";

const TAG = "GCSR";

export const SAMPLE_RATE = 16000;

/**
 * Create a recognition stream
 *
 *
 */
export function createRecognizeStream(
  language: string,
  callback: (err: any, text?: string) => void,
  interimResults = true,
  singleUtterance = true,
): any {
  let resolved = false;

  const stream = speech.streamingRecognize({
    singleUtterance,
    interimResults,
    config: {
      encoding: "LINEAR16",
      sampleRateHertz: SAMPLE_RATE,
      languageCode: getLocaleFromLanguageCode(language),
    },
  });

  stream.on("end", () => {
    if (resolved === false) {
      callback({
        unrecognized: true,
      });
    }
  });

  stream.on("error", err => {
    console.error(TAG, err);
    callback(err);
  });

  stream.on("data", data => {
    if (data.results.length > 0) {
      const r = data.results[0];
      if (r.alternatives) {
        console.debug(TAG, r.alternatives[0].transcript);
      }
      if (r.isFinal) {
        const text = r.alternatives[0].transcript;
        console.info(TAG, "recognized", text);
        resolved = true;
        callback(null, text);
      }
    }
  });

  return stream;
}

/**
 * Recognize a Stream and returns the text
 */
export async function recognizeStream(stream: fs.ReadStream, language: string): Promise<string> {
  return new Promise((resolve, reject) => {
    stream.pipe(
      createRecognizeStream(
        language,
        (err: any, text?: string) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(text);
        },
        false,
      ),
    );
  });
}

/**
 * Start a recognition stream
 *
 *
 */
export function recognize(stream: any, language: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    stream.pipe(
      createRecognizeStream(language, (err: any, text?: string) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(text);
      }),
    );
  });
}

/**
 * Recognize a local audio file
 */
export async function recognizeFile(
  file: string,
  language: string,
  convertFile = false,
  overrideFileWhenConvert = false,
) {
  let finalFile;

  if (convertFile) {
    const newFile = overrideFileWhenConvert ? file : `${file}.wav`;
    await Proc.spawn("ffmpeg", [
      overrideFileWhenConvert ? "-y" : "",
      "-i",
      file,
      "-acodec",
      "pcm_s16le",
      "-ar",
      SAMPLE_RATE,
      "-ac",
      "1",
      newFile,
    ]);
    finalFile = newFile;
  } else {
    finalFile = file;
  }

  return recognizeStream(fs.createReadStream(finalFile), language);
}
