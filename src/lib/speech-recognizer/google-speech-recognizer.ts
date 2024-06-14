import fs from "fs";
import { v1p1beta1 } from "@google-cloud/speech";
import { Language } from "../../types";
import { promisify } from "util";
// @ts-ignore
import wavFileInfo from "wav-file-info";
import { Signale } from "signale";
import Pumpify from "pumpify";
import { ISpeechRecognizer } from "../../stdlib/speech-recognizer";
import { SpeechClient } from "@google-cloud/speech/build/src/v1p1beta1";

const TAG = "GoogleSpeechRecognizer";
const logger = new Signale({
  scope: TAG,
});

export class GoogleSpeechRecognizer implements ISpeechRecognizer {
  private client: SpeechClient;
  public SAMPLE_RATE = 16000;

  constructor() {
    this.client = new v1p1beta1.SpeechClient();
  }
  /**
   * Create a recognition stream
   */
  createRecognizeStream(
    language: Language,
    callback: (err: any, text?: string) => void,
    audioConfig: any = {},
  ): Pumpify {
    let resolved = false;

    const stream = this.client.streamingRecognize({
      singleUtterance: true,
      interimResults: true,
      config: {
        encoding: "LINEAR16",
        sampleRateHertz: this.SAMPLE_RATE,
        ...audioConfig,
        languageCode: language,
      },
    });

    stream.on("end", () => {
      stream.destroy();

      if (resolved === false) {
        callback({
          unrecognized: true,
        });
      }
    });

    stream.on("error", (err) => {
      stream.destroy();
      logger.error(err);
      callback(err);
    });

    stream.on("data", (data) => {
      if (data.results.length > 0) {
        const r = data.results[0];
        if (r.alternatives) {
          logger.debug("->", r.alternatives[0].transcript);
        }
        if (r.isFinal) {
          const text = r.alternatives[0].transcript;
          logger.info("Recognized -> ", text);
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
          (err: any, text: string | undefined) => {
            if (err || !text) {
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
