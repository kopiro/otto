import { EventEmitter } from "events";
import config from "../config";
import { IODriverRuntime, IODriverOutput, IODriverEventMap, IODriverId } from "../stdlib/io-manager";
import { chunkArray, timeout } from "../helpers";
import { Fulfillment } from "../types";
import { etcDir } from "../paths";
import path from "path";
import { SpeechRecognizer } from "../stdlib/speech-recognizer";
import { Speaker } from "../stdlib/speaker";
import { Signale } from "signale";
import { Porcupine } from "@picovoice/porcupine-node";
import { Platform, getPlatform } from "../stdlib/platform";
// @ts-ignore
import recorder from "node-record-lpcm16";
import { getVoiceFileFromFulfillment, getVoiceFileFromMixedContent } from "../stdlib/voice-helpers";
import { IOChannel, TIOChannel } from "../data/io-channel";
import Pumpify from "pumpify";
import TypedEmitter from "typed-emitter";

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

const TIMEOUT_POLL_AI_STILL_SPEAKING_SEC = 2;
const HOTWORD_SILENCE_MAX_SEC = 3;

const MIC_CHANNELS = 1;

type VoiceConfig = {
  enableHotword: boolean;
  enableMic: boolean;
};

export class Voice implements IODriverRuntime {
  driverId: IODriverId = "voice";

  emitter = new EventEmitter() as TypedEmitter<IODriverEventMap>;

  conf: VoiceConfig;

  currentSpokenFulfillment: Fulfillment | undefined;

  recognizeStream: Pumpify | null | undefined;

  hotwordSilenceSec = -1;

  porcupine?: Porcupine | undefined;
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
  stopOutput() {
    // Kill any audible
    return Speaker.getInstance().kill();
  }

  /**
   * Create and assign the SR stream by attaching
   * the microphone input to GCP-SR stream
   */
  startRecognition(ioChannel: TIOChannel) {
    logger.debug("Recognizing microphone stream");

    // Close any previous stream
    this.destroyRecognizer();

    const recognizeStream = SpeechRecognizer.getInstance().createRecognizeStream(config().language, (err, text) => {
      this.recognizeStream = null;

      // If erred, emit an error and exit
      if (err) {
        if (err.unrecognized) {
          return;
        }

        this.emitter.emit("error", err.message, ioChannel, null);
        return;
      }

      // Otherwise, emit an INPUT message with the recognized text
      this.emitter.emit("input", { text }, ioChannel, null, null);
    });

    // Every time user speaks, reset the HWS timer to the max
    recognizeStream.on("data", (data) => {
      if (data.results.length > 0) {
        this.hotwordSilenceSec = HOTWORD_SILENCE_MAX_SEC;
      }
    });

    this.recognizeStream = recognizeStream;

    // Pipe current mic stream to SR stream
    this.recorder.stream().pipe(recognizeStream);

    this.emitter.emit("recognizing");
  }

  async registerInternalIOChannel() {
    return IOChannel.findByIOIdentifierOrCreate(this.driverId, "any", null, null);
  }

  destroyRecognizer() {
    if (this.recognizeStream) {
      logger.debug("Destroying recognizer stream");
      this.recognizeStream.destroy();
      this.recognizeStream = null;
    }
  }

  /**
   * Process the HWS ticker
   */
  processHotwordSilence() {
    if (this.hotwordSilenceSec === 0) {
      logger.info("Timeout exceeded, user should pronunce hotword again");
      this.hotwordSilenceSec = -1;
      this.destroyRecognizer();
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
  async wake() {
    const ioChannel = await this.registerInternalIOChannel();

    logger.info("Wake");
    this.emitter.emit("woken");

    this.stopOutput(); // Stop any previous output

    // Play a recognizable sound
    Speaker.getInstance().play(`${etcDir}/wake.wav`);

    // Reset any timer variable
    this.hotwordSilenceSec = HOTWORD_SILENCE_MAX_SEC;

    // Recreate the SRR-stream
    this.startRecognition(ioChannel);
  }

  /**
   * Stop the recognizer
   */
  stop() {
    logger.info("Stop");

    this.stopOutput();
    this.hotwordSilenceSec = -1;

    this.emitter.emit("stopped");
  }

  /**
   * Create and assign the hotword stream to listen for wake word
   */
  startHotwordDetection() {
    let frameAccumulator: number[] = [];

    const pvFile = path.join(etcDir, `porcupine`, `language.pv`);
    const ppnFile = path.join(etcDir, `porcupine`, `wakeword_${getPlatform()}.ppn`);

    this.porcupine = new Porcupine(config().porcupine.apiKey, [ppnFile], [0.5], pvFile);

    this.recorder.stream().on("data", (data: Buffer) => {
      // Two bytes per Int16 from the data buffer
      const newFrames16 = new Array(data.length / 2);
      for (let i = 0; i < data.length; i += 2) {
        newFrames16[i / 2] = data.readInt16LE(i);
      }

      // Split the incoming PCM integer data into arrays of size Porcupine.frameLength. If there's insufficient frames, or a remainder,
      // store it in 'frameAccumulator' for the next iteration, so that we don't miss any audio data
      frameAccumulator = frameAccumulator.concat(newFrames16);
      const frames = chunkArray(frameAccumulator, this.porcupine.frameLength);

      if (frames[frames.length - 1].length !== this.porcupine.frameLength) {
        // store remainder from divisions of frameLength
        frameAccumulator = frames.pop();
      } else {
        frameAccumulator = [];
      }

      for (const frame of frames) {
        const index = this.porcupine.process(frame as unknown as Int16Array);
        if (index !== -1) {
          this.wake();
        }
      }
    });
  }

  async actualOutput(fulfillment: Fulfillment): Promise<IODriverOutput> {
    const results: IODriverOutput = [];

    this.hotwordSilenceSec = -1; // Temporary disable timer variables

    if (this.recorder) {
      this.recorder.pause();
    }

    // Process a text if we do not find a audio
    try {
      if (fulfillment.text) {
        const file = await getVoiceFileFromFulfillment(fulfillment, config().language);
        await Speaker.getInstance().play(file);
      }
    } catch (err) {
      results.push(["error", err as Error]);
      logger.error(err);
    }

    // Process an Audio Object
    try {
      if (fulfillment.audio) {
        const file = await getVoiceFileFromMixedContent(fulfillment.audio);
        await Speaker.getInstance().play(file);
        results.push(["file", file.getAbsolutePath()]);
      }
    } catch (err) {
      results.push(["error", err]);
      logger.error(err);
    }

    if (this.recorder) {
      this.recorder.resume();
    }

    return results;
  }

  /**
   * Process the item in the output queue
   */
  async output(fulfillment: Fulfillment): Promise<IODriverOutput> {
    let results: IODriverOutput = [];

    // If we have a current processed item, let's wait until it's null
    while (this.currentSpokenFulfillment) {
      logger.debug("Waiting until agent is not speaking...");
      // eslint-disable-next-line no-await-in-loop
      results.push(["timeout", TIMEOUT_POLL_AI_STILL_SPEAKING_SEC]);
      await timeout(TIMEOUT_POLL_AI_STILL_SPEAKING_SEC * 1000);
    }

    this.currentSpokenFulfillment = fulfillment;

    try {
      const result = await this.actualOutput(fulfillment);
      results = results.concat(result);
    } finally {
      this.currentSpokenFulfillment = null;
    }

    return results;
  }

  /**
   * Start the ioChannel
   */
  async start() {
    const ioChannel = await this.registerInternalIOChannel();
    logger.debug(`Internal Voice session`, ioChannel);

    this.emitter.on("wake", this.wake.bind(this));
    this.emitter.on("stop", this.stop.bind(this));

    if (this.conf.enableMic) {
      this.recorder = recorder.record({
        sampleRate: SpeechRecognizer.getInstance().SAMPLE_RATE,
        channels: MIC_CHANNELS,
        audioType: "raw",
        recorder: MIC_PLATFORM_TO_BINARY[getPlatform()],
      });

      if (this.conf.enableHotword) {
        try {
          this.startHotwordDetection();
          setInterval(this.processHotwordSilence.bind(this), 1000);
        } catch (err) {
          logger.warn(err);
        }
      }
    }
  }
}

let _instance: Voice;
export default (): Voice => {
  _instance = _instance || new Voice(config().voice);
  return _instance;
};
