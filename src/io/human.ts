import Events from "events";
import config from "../config";
import { IODriverRuntime, IODriverOutput } from "../stdlib/iomanager";
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
import { getVoiceFileFromFulfillment, getVoiceFileFromURI } from "../stdlib/voice";
import { Session, TSession } from "../data/session";

const TAG = "IO.Human";
const logger = new Signale({
  scope: TAG,
});

const DRIVER_ID = "human";

const MIC_PLATFORM_TO_BINARY: Record<Platform, string> = {
  pi: "arecord",
  macos: "sox",
  unknown: "sox",
};

/**
 * Number of seconds of silence after that
 * user should proununce wake word again to activate te SR
 */
const HOTWORD_SILENCE_MAX = 8;

type HumanConfig = {
  enableHotword: boolean;
  enableMic: boolean;
};

export class Human implements IODriverRuntime {
  conf: HumanConfig;
  emitter: Events.EventEmitter = new Events.EventEmitter();

  /**
   * TRUE when the audio is recording and it's submitting to GCP-SR
   */
  isRecognizing = false;

  /**
   * Current item processed by the queue
   */
  currentSpokenFulfillment: Fulfillment | null | undefined;

  /**
   * ID for setInterval used by HOTWORD_SILENCE_MAX
   */
  hotwordSilenceSecIntv: NodeJS.Timer | undefined;

  /**
   * Tick used by HOTWORD_SILENCE_MAX
   */
  hotwordSilenceSec = -1;

  /**
   * Microphone stream
   */
  porcupine: Porcupine | undefined;
  mic: any | undefined;

  /**
   * Constructor
   * @param config
   */
  constructor(config: HumanConfig) {
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
  startRecognition(session: TSession) {
    logger.debug("recognizing microphone stream");

    const recognizeStream = SpeechRecognizer.getInstance().createRecognizeStream(session.getLanguage(), (err, text) => {
      this.isRecognizing = false;
      this.emitter.emit("notrecognizing");

      // If erred, emit an error and exit
      if (err) {
        if (err.unrecognized) {
          return;
        }
        this.emitter.emit("input", {
          session,
          error: err,
        });
        return;
      }

      // Otherwise, emit an INPUT message with the recognized text
      this.emitter.emit("input", {
        session,
        params: {
          text,
        },
      });
    });

    // Every time user speaks, reset the HWS timer to the max
    recognizeStream.on("data", (data) => {
      if (data.results.length > 0) {
        this.hotwordSilenceSec = HOTWORD_SILENCE_MAX;
      }
    });

    // Pipe current mic stream to SR stream
    this.mic?.stream().pipe(recognizeStream);
    this.isRecognizing = true;
    this.emitter.emit("recognizing");
  }

  /**
   * Register the global session used by this driver
   */
  async registerInternalSession() {
    return Session.findByIOIdentifierOrCreate(DRIVER_ID, "any");
  }

  /**
   * Process the HWS ticker
   */
  processHotwordSilence() {
    if (this.hotwordSilenceSec === 0) {
      logger.info("timeout exceeded, user should pronunce hotword again");
      this.hotwordSilenceSec = -1;
    } else if (this.hotwordSilenceSec > 0) {
      logger.debug(`${this.hotwordSilenceSec}s left before reset`);
      this.hotwordSilenceSec--;
    }
  }

  /**
   * Register the HWS setInterval ID
   */
  registerHotwordSilenceSecIntv() {
    if (this.hotwordSilenceSecIntv) clearInterval(this.hotwordSilenceSecIntv);
    this.hotwordSilenceSecIntv = setInterval(this.processHotwordSilence.bind(this), 1000);
  }

  /**
   * Wake the bot and listen for intents
   */
  async wake() {
    const session = await this.registerInternalSession();

    logger.info("wake");
    this.emitter.emit("woken");

    this.stopOutput(); // Stop any previous output

    // Play a recognizable sound
    Speaker.getInstance().play(`${etcDir}/wake.wav`);

    // Reset any timer variable
    this.hotwordSilenceSec = HOTWORD_SILENCE_MAX;

    // Recreate the SRR-stream
    this.startRecognition(session);
  }

  /**
   * Stop the recognizer
   */
  stop() {
    logger.info("stop");
    this.stopOutput();
    this.hotwordSilenceSec = -1;
    this.emitter.emit("stopped");
  }

  /**
   * Create and assign the hotword stream to listen for wake word
   */
  startHotwordDetection() {
    // We need to dynamically load this as it may be not necessary to include it
    // eslint-disable-next-line @typescript-eslint/no-var-requires

    let frameAccumulator: number[] = [];

    const pvFile = path.join(etcDir, `porcupine`, `language.pv`);
    const ppnFile = path.join(etcDir, `porcupine`, `wakeword_${getPlatform()}.ppn`);

    this.porcupine = new Porcupine(config().porcupine.apiKey, [ppnFile], [0.5], pvFile);

    this.mic.stream().on("data", (data: Buffer) => {
      // Two bytes per Int16 from the data buffer
      const newFrames16 = new Array(data.length / 2);
      for (let i = 0; i < data.length; i += 2) {
        newFrames16[i / 2] = data.readInt16LE(i);
      }

      // Split the incoming PCM integer data into arrays of size Porcupine.frameLength. If there's insufficient frames, or a remainder,
      // store it in 'frameAccumulator' for the next iteration, so that we don't miss any audio data
      frameAccumulator = frameAccumulator.concat(newFrames16);
      const frames = chunkArray(frameAccumulator, this.porcupine!.frameLength);

      if (frames[frames.length - 1].length !== this.porcupine!.frameLength) {
        // store remainder from divisions of frameLength
        frameAccumulator = frames.pop()!;
      } else {
        frameAccumulator = [];
      }

      for (const frame of frames) {
        const index = this.porcupine!.process(frame as unknown as Int16Array);
        if (index !== -1) {
          logger.debug(`Detected hotword!`);
          this.wake();
        }
      }
    });
  }

  async _output(fulfillment: Fulfillment, session: TSession): Promise<IODriverOutput> {
    const results: IODriverOutput = [];

    this.hotwordSilenceSec = -1; // Temporary disable timer variables

    this.emitter.emit("output", {
      session,
      fulfillment,
    });

    // Process a text if we do not find a audio
    try {
      if (fulfillment.text) {
        const file = await getVoiceFileFromFulfillment(fulfillment, session);
        console.log("file :>> ", file);
        await Speaker.getInstance().play(file);
        results.push(["file", file.getAbsolutePath()]);
      }
    } catch (err) {
      results.push(["error", err as Error]);
      logger.error(err);
    }

    // Process an Audio Object
    try {
      if (fulfillment.audio) {
        const file = await getVoiceFileFromURI(fulfillment.audio);
        await Speaker.getInstance().play(file);
        results.push(["file", file.getAbsolutePath()]);
      }
    } catch (err) {
      results.push(["error", err]);
      logger.error(err);
    }

    return results;
  }

  static SLEEP_WAIT_STILL_SPEAKING = 2000;

  /**
   * Process the item in the output queue
   */
  async output(fulfillment: Fulfillment, session: TSession): Promise<any[]> {
    console.log("output :>> ", fulfillment);
    let results = [];

    // If we have a current processed item, let's wait until it's null
    while (this.currentSpokenFulfillment) {
      logger.debug("waiting until agent is not speaking...");
      // eslint-disable-next-line no-await-in-loop
      results.push(["timeout", Human.SLEEP_WAIT_STILL_SPEAKING]);
      await timeout(Human.SLEEP_WAIT_STILL_SPEAKING);
    }

    this.currentSpokenFulfillment = fulfillment;

    try {
      const result = await this._output(fulfillment, session);
      results = results.concat(result);
    } finally {
      this.currentSpokenFulfillment = null;
    }

    return results;
  }

  /**
   * Start the session
   */
  async start() {
    const session = await this.registerInternalSession();
    logger.debug(`Started, session ID: ${session.id}`);

    this.emitter.on("wake", this.wake);
    this.emitter.on("stop", this.stop);

    if (this.conf.enableMic) {
      this.mic = recorder.record({
        sampleRate: 16000,
        channels: 1,
        audioType: "raw",
        recorder: MIC_PLATFORM_TO_BINARY[getPlatform()],
      });

      if (this.conf.enableHotword) {
        try {
          this.startHotwordDetection();
          this.registerHotwordSilenceSecIntv();
        } catch (err) {
          logger.warn(err);
        }
      }
    }
  }
}

let _instance: Human;
export default (): Human => {
  _instance = _instance || new Human(config().human);
  return _instance;
};
