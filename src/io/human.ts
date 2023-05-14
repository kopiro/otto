import Events from "events";
import config from "../config";
import * as IOManager from "../stdlib/iomanager";
import voice from "../stdlib/voice";
import { getSessionTranslateFrom, getSessionTranslateTo, timeout } from "../helpers";
import { Fulfillment, Session } from "../types";
import { etcDir } from "../paths";
import path from "path";
import recorder from "node-record-lpcm16";
import { COMPUTER } from "@picovoice/porcupine-node/builtin_keywords";
import { getPlatform } from "@picovoice/porcupine-node/platforms";
import os from "os";
import fs from "fs";
import textToSpeech from "../stdlib/text-to-speech";
import speechRecognizer from "../stdlib/speech-recognizer";
import speaker from "../stdlib/speaker";
import { Signale } from "signale";

const TAG = "IO.Human";
const console = new Signale({
  scope: TAG,
});

const DRIVER_ID = "human";

const PLATFORM_RECORDER_MAP: Map<NodeJS.Platform, string> = new Map();
PLATFORM_RECORDER_MAP.set("linux", "arecord");

/**
 * Number of seconds of silence after that
 * user should proununce wake word again to activate te SR
 */
const HOTWORD_SILENCE_MAX = 8;

type HumanConfig = {
  enableHotword: boolean;
  enableMic: boolean;
  defaultBinaryRecorder: string;
};

function chunkArray(array: any[], size: number) {
  return Array.from({ length: Math.ceil(array.length / size) }, (v, index) =>
    array.slice(index * size, index * size + size),
  );
}

export class Human implements IOManager.IODriverModule {
  config: HumanConfig;
  emitter: Events.EventEmitter = new Events.EventEmitter();

  /**
   * TRUE when the audio is recording and it's submitting to GCP-SR
   */
  isRecognizing = false;

  /**
   * Current item processed by the queue
   */
  currentSpokenFulfillment = null;

  /**
   * ID for setInterval used by HOTWORD_SILENCE_MAX
   */
  hotwordSilenceSecIntv = null;

  /**
   * Tick used by HOTWORD_SILENCE_MAX
   */
  hotwordSilenceSec = -1;

  /**
   * Microphone stream
   */
  porcupine = null;
  mic = null;

  /**
   * Constructor
   * @param config
   */
  constructor(config: HumanConfig) {
    this.config = config;
  }

  /**
   * Stop current output by killing processed and flushing the queue
   */
  stopOutput() {
    // Kill any audible
    return speaker().kill();
  }

  /**
   * Create and assign the SR stream by attaching
   * the microphone input to GCP-SR stream
   */
  startRecognition(session: Session) {
    console.log("recognizing microphone stream");

    const recognizeStream = speechRecognizer().createRecognizeStream(getSessionTranslateFrom(session), (err, text) => {
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
    this.mic.stream().pipe(recognizeStream);
    this.isRecognizing = true;
    this.emitter.emit("recognizing");
  }

  /**
   * Register the global session used by this driver
   */
  async registerInternalSession() {
    return IOManager.registerSession(DRIVER_ID);
  }

  /**
   * Process the HWS ticker
   */
  processHotwordSilence() {
    if (this.hotwordSilenceSec === 0) {
      console.info("timeout exceeded, user should pronunce hotword again");
      this.hotwordSilenceSec = -1;
    } else if (this.hotwordSilenceSec > 0) {
      console.debug(`${this.hotwordSilenceSec}s left before reset`);
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

    console.info("wake");
    this.emitter.emit("woken");

    this.stopOutput(); // Stop any previous output

    // Play a recognizable sound
    speaker().play(`${etcDir}/wake.wav`);

    // Reset any timer variable
    this.hotwordSilenceSec = HOTWORD_SILENCE_MAX;

    // Recreate the SRR-stream
    this.startRecognition(session);
  }

  /**
   * Stop the recognizer
   */
  stop() {
    console.info("stop");
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
    const Porcupine = require("@picovoice/porcupine-node");

    let frameAccumulator = [];

    const ppnFile = path.join(etcDir, `hey_otto_${getPlatform()}.ppn`);
    if (fs.existsSync(ppnFile)) {
      this.porcupine = new Porcupine([ppnFile], [0.5]);
    } else {
      console.error(`ppnFile ${ppnFile} not present, fallback to "COMPUTER" keyword`);
      this.porcupine = new Porcupine([COMPUTER], [0.5]);
    }

    this.mic.stream().on("data", (data) => {
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
        const index = this.porcupine.process(frame);
        if (index !== -1) {
          console.log(`Detected hotword!`);
          this.wake();
        }
      }
    });
  }

  async _output(fulfillment: Fulfillment, session: Session) {
    const results = [];

    this.hotwordSilenceSec = -1; // Temporary disable timer variables

    this.emitter.emit("output", {
      session,
      fulfillment,
    });

    // Process a text if we do not find a audio
    try {
      if (fulfillment.text) {
        const audioFile = await textToSpeech().getAudioFile(
          fulfillment.text,
          getSessionTranslateTo(session),
          config().tts.gender,
        );
        const file = await voice().getFile(audioFile);
        await speaker().play(file);
        results.push(["file", file]);
      }
    } catch (err) {
      results.push(["error", err]);
      console.error(err);
    }

    // Process an Audio Object
    try {
      if (fulfillment.audio) {
        const file = await voice().getFile(fulfillment.audio);
        await speaker().play(file);
        results.push(["file", file]);
      }
    } catch (err) {
      results.push(["error", err]);
      console.error(err);
    }

    return results;
  }

  static SLEEP_WAIT_STILL_SPEAKING = 2000;

  /**
   * Process the item in the output queue
   */
  async output(fulfillment: Fulfillment, session: Session): Promise<any[]> {
    let results = [];

    // If we have a current processed item, let's wait until it's null
    while (this.currentSpokenFulfillment) {
      console.log("waiting until agent is not speaking...");
      // eslint-disable-next-line no-await-in-loop
      results.push(["timeout", Human.SLEEP_WAIT_STILL_SPEAKING]);
      await timeout(Human.SLEEP_WAIT_STILL_SPEAKING);
    }

    this.currentSpokenFulfillment = fulfillment;

    try {
      results = results.concat(await this._output(fulfillment, session));
    } finally {
      this.currentSpokenFulfillment = null;
    }

    return results;
  }

  /**
   * Start the session
   */
  async start(): Promise<boolean> {
    const session = await this.registerInternalSession();
    console.log(`started, sessionID: ${session.id}`);

    this.emitter.on("wake", this.wake);
    this.emitter.on("stop", this.stop);

    if (this.config.enableMic) {
      this.mic = recorder.record({
        sampleRate: 16000,
        channels: 1,
        audioType: "raw",
        recorder: PLATFORM_RECORDER_MAP.get(os.platform()) ?? this.config.defaultBinaryRecorder,
      });

      if (this.config.enableHotword) {
        try {
          this.startHotwordDetection();
          this.registerHotwordSilenceSecIntv();
        } catch (err) {
          console.warn(err);
        }
      }
    }

    return true;
  }
}

let _instance: Human;
export default (): Human => {
  _instance = _instance || new Human(config().human);
  return _instance;
};
