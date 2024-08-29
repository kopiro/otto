import { EventEmitter } from "events";
import config from "../config";
import {
  IODriverRuntime,
  IODriverMultiOutput,
  IODriverEventMap,
  IODriverId,
  IODriverSingleOutput,
} from "../stdlib/io-manager";
import { chunkArray, timeout } from "../helpers";
import { Fulfillment, Language } from "../types";
import { etcDir } from "../paths";
import path from "path";
import { SpeechRecognizer } from "../stdlib/speech-recognizer";
import { Speaker } from "../stdlib/speaker";
import { Signale } from "signale";
import { Porcupine } from "@picovoice/porcupine-node";
import { Platform, getPlatform } from "../stdlib/platform";
// @ts-ignore
import recorder from "node-record-lpcm16";
import { getVoiceFileFromMixedContent, getVoiceFileFromText } from "../stdlib/voice-helpers";
import { IOChannel, TIOChannel } from "../data/io-channel";
import Pumpify from "pumpify";
import TypedEmitter from "typed-emitter";
import { TPerson } from "../data/person";
import { isDocument } from "@typegoose/typegoose";

const TAG = "IO.Voice";
const logger = new Signale({
  scope: TAG,
});

export type IODataVoice = null;
export type IOBagVoice = null;

const MIC_PLATFORM_TO_BINARY: Record<Platform, string> = {
  pi: "arecord",
  macos: "sox",
  unknown: "sox",
};

const TIMEOUT_POLL_AI_STILL_SPEAKING_SEC = 4;

const MIC_CHANNELS = 1;

type VoiceConfig = {
  enableHotword: boolean;
  enableMic: boolean;
  hotwordSilenceMaxSec: number;
};

export class Voice implements IODriverRuntime {
  driverId: IODriverId = "voice";
  emitter = new EventEmitter() as TypedEmitter<IODriverEventMap>;
  conf: VoiceConfig;
  started = false;

  ioChannel!: TIOChannel;
  person!: TPerson;

  currentSpokenFulfillment: Fulfillment | undefined;
  recognizeStream: Pumpify | null | undefined;
  hotwordSilenceSec = -1;
  recorder: any | undefined;

  /**
   * Constructor
   * @param config
   */
  constructor(config: VoiceConfig) {
    this.conf = config;
  }

  /**
   * Stop current output by killing processed and flushing the queue
   */
  private stopOutput() {
    // Kill any audible
    return Speaker.getInstance().kill();
  }

  /**
   * Create and assign the SR stream by attaching
   * the microphone input to GCP-SR stream
   */
  private startRecognition() {
    logger.debug("Recognizing microphone stream");

    this.recognizeStream = SpeechRecognizer.getInstance().createRecognizeStream(this.person.language, (err, text) => {
      // When ended, destroy stream
      this.destroyRecognizer();

      // If erred, emit an error and exit
      if (err) {
        if (err.unrecognized) {
          return;
        }

        this.emitter.emit("error", err.message, this.ioChannel, this.person);
        return;
      }

      if (!text) {
        return;
      }

      // Otherwise, emit an INPUT message with the recognized text
      this.emitter.emit("input", { text }, this.ioChannel, this.person, null);
    });

    // Every time user speaks, reset the HWS timer to the max
    this.recognizeStream.on("data", (data) => {
      if (data.results.length > 0) {
        // every time user speaks, give it more time to speak
        this.hotwordSilenceSec = this.conf.hotwordSilenceMaxSec;
      }
    });

    // Pipe current mic stream to SR stream
    this.recorder.stream().pipe(this.recognizeStream);

    this.emitter.emit("recognizing");
  }

  private async registerInternalModels() {
    this.ioChannel = await IOChannel.findByIOIdentifierOrCreate(this.driverId, "any", null, null);
    if (!isDocument(this.ioChannel.person)) {
      throw new Error("Invalid person");
    }

    this.person = this.ioChannel.person;
  }

  private destroyRecognizer() {
    if (this.recognizeStream) {
      logger.debug("Destroying recognizer stream");
      this.recognizeStream.destroy();
      this.recognizeStream = null;
    }
  }

  /**
   * Process the HWS ticker
   */
  private processHotwordSilence() {
    if (this.hotwordSilenceSec === 0) {
      logger.warn("Timeout exceeded, user should pronunce hotword again");
      this.hotwordSilenceSec = -1;
      // detach recorder from SR stream
      this.destroyRecognizer();
      this.startMic();
      return;
    }

    if (this.hotwordSilenceSec > 0) {
      logger.debug(`Stopping SR in ${this.hotwordSilenceSec}s ...`);
      this.hotwordSilenceSec--;
    }
  }

  /**
   * Wake the bot and listen for intents
   */
  private async wake() {
    this.emitter.emit("woken");

    this.stopOutput(); // Stop any previous output

    // Play a recognizable sound
    Speaker.getInstance().play(`${etcDir}/wake.wav`);

    // Reset any timer variable
    this.hotwordSilenceSec = this.conf.hotwordSilenceMaxSec;

    // Recreate the SRR-stream
    this.startRecognition();
  }

  /**
   * Stop the recognizer
   */
  stop() {
    this.stopOutput();
    this.hotwordSilenceSec = -1;

    this.emitter.emit("stopped");
  }

  /**
   * Create and assign the hotword stream to listen for wake word
   */
  private startHotwordDetection() {
    let frameAccumulator: number[] = [];

    const pvFile = path.join(etcDir, `porcupine`, `language.pv`);
    const ppnFile = path.join(etcDir, `porcupine`, `wakeword_${getPlatform()}.ppn`);

    const porcupine = new Porcupine(config().porcupine.apiKey, [ppnFile], [0.5], pvFile);

    this.recorder.stream().on("data", (data: Buffer) => {
      process.stdout.write(".");

      // Two bytes per Int16 from the data buffer
      const newFrames16 = new Array(data.length / 2);
      for (let i = 0; i < data.length; i += 2) {
        newFrames16[i / 2] = data.readInt16LE(i);
      }

      // Split the incoming PCM integer data into arrays of size Porcupine.frameLength. If there's insufficient frames, or a remainder,
      // store it in 'frameAccumulator' for the next iteration, so that we don't miss any audio data
      frameAccumulator = frameAccumulator.concat(newFrames16);
      const frames = chunkArray(frameAccumulator, porcupine.frameLength);

      if (frames[frames.length - 1].length !== porcupine.frameLength) {
        // store remainder from divisions of frameLength
        // @ts-ignore
        frameAccumulator = frames.pop();
      } else {
        frameAccumulator = [];
      }

      for (const frame of frames) {
        const index = porcupine.process(frame as unknown as Int16Array);
        if (index !== -1) {
          this.wake();
        }
      }
    });
  }

  private async outputText(text: string, personLanguage: Language | undefined): Promise<IODriverSingleOutput> {
    try {
      const file = await getVoiceFileFromText(text, personLanguage);
      await Speaker.getInstance().play(file);
      return ["file", file.getAbsolutePath()];
    } catch (err) {
      logger.error(err);
      return ["error", err];
    }
  }

  private async outputAudio(audio: string): Promise<IODriverSingleOutput> {
    try {
      const file = await getVoiceFileFromMixedContent(audio);
      await Speaker.getInstance().play(file);
      return ["file", file.getAbsolutePath()];
    } catch (err) {
      return ["error", err];
    }
  }

  async actualOutput(f: Fulfillment, ioChannel: TIOChannel, person: TPerson): Promise<IODriverMultiOutput> {
    const results: IODriverMultiOutput = [];

    // Temporary disable timer variables
    this.hotwordSilenceSec = -1;

    if (this.recorder) {
      this.recorder.pause();
    }

    // Process a text by converting it to Audio
    if (f.text) {
      results.push(await this.outputText(f.text, person.language));
    }

    if (f.audio) {
      results.push(await this.outputAudio(f.audio));
    }

    if (f.voice) {
      results.push(await this.outputAudio(f.voice));
    }

    if (this.recorder) {
      this.recorder.resume();
    }

    return results;
  }

  /**
   * Process the item in the output queue
   */
  async output(f: Fulfillment, ioChannel: TIOChannel, person: TPerson): Promise<IODriverMultiOutput> {
    let results: IODriverMultiOutput = [];

    // If we have a current processed item, let's wait until it's null
    while (this.currentSpokenFulfillment) {
      logger.debug("Waiting until agent is not speaking...");
      await timeout(TIMEOUT_POLL_AI_STILL_SPEAKING_SEC * 1000);
    }

    this.currentSpokenFulfillment = f;

    try {
      const result = await this.actualOutput(f, ioChannel, person);
      results = results.concat(result);
    } finally {
      this.currentSpokenFulfillment = undefined;
    }

    return results;
  }

  async startMic() {
    if (this.conf.enableMic) {
      if (this.recorder) {
        this.recorder.stop();
      }

      this.recorder = recorder.record({
        sampleRate: SpeechRecognizer.getInstance().SAMPLE_RATE,
        channels: MIC_CHANNELS,
        audioType: "raw",
        recorder: MIC_PLATFORM_TO_BINARY[getPlatform()],
      });

      if (this.conf.enableHotword) {
        try {
          this.startHotwordDetection();
        } catch (err) {
          logger.warn(err);
        }
      }
    }
  }

  /**
   * Start the ioChannel
   */
  async start() {
    if (this.started) return;
    this.started = true;

    await this.registerInternalModels();
    setInterval(this.processHotwordSilence.bind(this), 1000);

    this.emitter.on("wake", this.wake.bind(this));
    this.emitter.on("stop", this.stop.bind(this));

    this.startMic();
  }
}

let _instance: Voice;
export default (): Voice => {
  _instance = _instance || new Voice(config().voice);
  return _instance;
};
