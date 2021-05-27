import speech from "@google-cloud/speech";
import fs from "fs";
import { getLocaleFromLanguageCode } from "../helpers";
import { SpeechRecognizer } from "../abstracts/speech-recognizer";
import { SpeechClient } from "@google-cloud/speech/build/src/v1";
import { Language } from "../types";
import { promisify } from "util";
import wavFileInfo from "wav-file-info";

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
  createRecognizeStream(language: Language, callback: (err: any, text?: string) => void, audioConfig: any = {}) {
    let resolved = false;

    const stream = this.client.streamingRecognize({
      singleUtterance: true,
      interimResults: true,
      config: {
        encoding: "LINEAR16",
        sampleRateHertz: this.SAMPLE_RATE,
        ...audioConfig,
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
  async recognizeStream(stream: fs.ReadStream, language: Language, audioConfig?: any): Promise<string> {
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
          audioConfig,
        ),
      );
    });
  }

  /**
   * Recognize a local audio file
   */
  async recognizeFile(file: string, language: Language): Promise<string> {
    const wav = await promisify(wavFileInfo.infoByFilename)(file);
    return this.recognizeStream(fs.createReadStream(file), language, {
      sampleRateHertz: wav.header.sample_rate,
      audioChannelCount: wav.header.num_channels,
    });
  }
}
