import speech from "@google-cloud/speech";
import fs from "fs";
import * as Proc from "./proc";
import { getLocaleFromLanguageCode } from "../helpers";
import { SpeechRecognizer } from "../abstracts/speech-recognizer";
import { SpeechClient } from "@google-cloud/speech/build/src/v1";
import { Language } from "../types";

const TAG = "GCSR";

export class GoogleSpeechRecognizer extends SpeechRecognizer {
  client: SpeechClient;
  SAMPLE_RATE = 16000;

  constructor() {
    super();
    this.client = new speech.SpeechClient();
  }
  /**
   * Create a recognition stream
   */
  createRecognizeStream(
    language: Language,
    callback: (err: any, text?: string) => void,
    interimResults = true,
    singleUtterance = true,
  ) {
    let resolved = false;

    const stream = this.client.streamingRecognize({
      singleUtterance,
      interimResults,
      config: {
        encoding: "LINEAR16",
        sampleRateHertz: this.SAMPLE_RATE,
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

    stream.on("error", (err) => {
      console.error(TAG, err);
      callback(err);
    });

    stream.on("data", (data) => {
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
  async recognizeStream(stream: fs.ReadStream, language: Language): Promise<string> {
    return new Promise((resolve, reject) => {
      stream.pipe(
        this.createRecognizeStream(
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
   * Recognize a local audio file
   */
  async recognizeFile(
    file: string,
    language: Language,
    convertFile = false,
    overrideFileWhenConvert = false,
  ): Promise<string> {
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
        this.SAMPLE_RATE,
        "-ac",
        "1",
        newFile,
      ]);
      finalFile = newFile;
    } else {
      finalFile = file;
    }

    return this.recognizeStream(fs.createReadStream(finalFile), language);
  }
}
