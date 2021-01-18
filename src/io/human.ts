import Events from "events";
import config from "../config";
import * as IOManager from "../stdlib/iomanager";
import SpeechRecognizer from "../stdlib/speech-recognizer";
import Voice from "../stdlib/voice";
import Speaker from "../stdlib/speaker";
import TextToSpeech from "../stdlib/text-to-speech";
import { timeout } from "../helpers";
import { Fulfillment, Session } from "../types";
import Porcupine from "@picovoice/porcupine-node";
import { etcDir } from "../paths";
import path from "path";
import recorder from "node-record-lpcm16";
import { COMPUTER } from "@picovoice/porcupine-node/builtin_keywords";
import { getPlatform } from "@picovoice/porcupine-node/platforms";
import os from "os";
import fs from "fs";

const TAG = "IO.Human";
const DRIVER_ID = "human";

const PLATFORM_RECORDER_MAP: Map<NodeJS.Platform, string> = new Map();
PLATFORM_RECORDER_MAP.set("linux", "arecord");

/**
 * Number of seconds of silence after that
 * user should proununce wake word again to activate te SR
 */
const HOTWORD_SILENCE_MAX = 8;

type HumanConfig = {};

function chunkArray(array, size) {
  return Array.from({ length: Math.ceil(array.length / size) }, (v, index) =>
    array.slice(index * size, index * size + size),
  );
}

class Human implements IOManager.IODriverModule {
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
  constructor(config) {
    this.config = config;
  }

  /**
   * Stop current output by killing processed and flushing the queue
   */
  stopOutput() {
    // Kill any audible
    return Speaker.kill();
  }

  /**
   * Create and assign the SR stream by attaching
   * the microphone input to GCP-SR stream
   */
  startRecognition(session: Session) {
    console.log(TAG, "recognizing microphone stream");

    const recognizeStream = SpeechRecognizer.createRecognizeStream(session.getTranslateFrom(), (err, text) => {
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
      console.info(TAG, "timeout exceeded, user should pronunce hotword again");
      this.hotwordSilenceSec = -1;
    } else if (this.hotwordSilenceSec > 0) {
      console.debug(TAG, `${this.hotwordSilenceSec}s left before reset`);
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

    console.info(TAG, "wake");
    this.emitter.emit("woken");

    this.stopOutput(); // Stop any previous output

    // Play a recognizable sound
    Speaker.play(`${etcDir}/wake.wav`);

    // Reset any timer variable
    this.hotwordSilenceSec = HOTWORD_SILENCE_MAX;

    // Recreate the SRR-stream
    this.startRecognition(session);
  }

  /**
   * Stop the recognizer
   */
  stop() {
    console.info(TAG, "stop");
    this.stopOutput();
    this.hotwordSilenceSec = -1;
    this.emitter.emit("stopped");
  }

  /**
   * Create and assign the hotword stream to listen for wake word
   */
  startHotwordDetection() {
    let frameAccumulator = [];

    const ppnFile = path.join(etcDir, `hey_otto_${getPlatform()}.ppn`);
    if (fs.existsSync(ppnFile)) {
      this.porcupine = new Porcupine([ppnFile], [0.5]);
    } else {
      console.error(TAG, 'ppnFile ${ppnFile} not present, fallback to "COMPUTER" keyword');
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
          console.log(TAG, `Detected hotword!`);
          this.wake();
        }
      }
    });
  }

  async _output(fulfillment: Fulfillment, session: Session): Promise<boolean> {
    this.hotwordSilenceSec = -1; // Temporary disable timer variables

    this.emitter.emit("output", {
      session,
      fulfillment,
    });

    let processed = false;
    const language = fulfillment.payload.language || session.getTranslateTo();

    // Process an Audio
    try {
      if (fulfillment.audio) {
        const file = await Voice.getFile(fulfillment.audio);
        await Speaker.play(file);
        processed = true;
      }
    } catch (err) {
      console.error(TAG, err);
    }

    // Process a text if we do not find a audio
    try {
      if (fulfillment.fulfillmentText && !processed) {
        console.warn(
          TAG,
          "using deprecated fulfillmentText instead of using audio from Dialogflow - this is fine if you're requiring a translation",
        );
        const audioFile = await TextToSpeech.getAudioFile(fulfillment.fulfillmentText, language, config().tts.gender);
        const file = await Voice.getFile(audioFile);
        await Speaker.play(file);
        processed = true;
      }
    } catch (err) {
      console.error(TAG, err);
    }

    // Process an Audio Object
    try {
      if (fulfillment.payload.audio) {
        await Speaker.play(fulfillment.payload.audio.uri);
        processed = true;
      }
    } catch (err) {
      console.error(TAG, err);
    }

    if (fulfillment.payload.feedback) {
      this.emitter.emit("thinking");
    }

    if (fulfillment.payload.welcome) {
      this.emitter.emit("stop");
    }

    return processed;
  }

  /**
   * Process the item in the output queue
   */
  async output(fulfillment: Fulfillment, session: Session): Promise<boolean> {
    // If we have a current processed item, let's wait until it's null
    while (this.currentSpokenFulfillment) {
      console.log(TAG, "waiting until agent is not speaking...");
      // eslint-disable-next-line no-await-in-loop
      await timeout(2000);
    }

    this.currentSpokenFulfillment = fulfillment;

    try {
      return await this._output(fulfillment, session);
    } finally {
      this.currentSpokenFulfillment = null;
    }
  }

  /**
   * Start the session
   */
  async start() {
    const session = await this.registerInternalSession();
    console.log(TAG, `started, sessionID: ${session.id}`);

    this.emitter.on("wake", this.wake);
    this.emitter.on("stop", this.stop);

    this.mic = recorder.record({
      sampleRate: 16000,
      channels: 1,
      audioType: "raw",
      recorder: PLATFORM_RECORDER_MAP.get(os.platform()) ?? "sox",
    });

    // // Start all timers
    this.startHotwordDetection();
    this.registerHotwordSilenceSecIntv();
  }
}

export default new Human(config().human);
