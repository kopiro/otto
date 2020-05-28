import Events from "events";
import * as Rec from "../lib/rec";
import config from "../config";
import * as IOManager from "../stdlib/iomanager";
import SpeechRecognizer from "../stdlib/speech-recognizer";
import * as Play from "../lib/play";
import { etcDir } from "../paths";
import TextToSpeech from "../stdlib/text-to-speech";
import { timeout } from "../helpers";
import { Fulfillment, Session } from "../types";

const TAG = "IO.Human";
const DRIVER_ID = "human";

/**
 * When the wake word has been detected,
 * wait an amount of ticks defined by this constant
 * after that user should be prompted by voice
 */
const WAKE_WORD_TICKS = 6;

/**
 * Number of seconds of silence after that
 * user should proununce wake word again to activate te SR
 */
const EOR_MAX = 8;

type HumanConfig = {};

class Human implements IOManager.IODriverModule {
  config: HumanConfig;
  emitter: Events.EventEmitter = new Events.EventEmitter();

  /**
   * TRUE when the audio is recording and it's submitting to GCP-SR
   */
  isRecognizing = false;

  /**
   * Stream object created by GCP-SR
   */
  recognizeStream = null;

  /**
   * Current item processed by the queue
   */
  currentSpokenFulfillment = null;

  /**
   * Tick used by WAKE_WORDS_TICKS
   */
  wakeWordTick = -1;

  /**
   * ID for setInterval used by EOR_MAX
   */
  eorInterval = null;

  /**
   * Tick used by EOR_MAX
   */
  eorTick = -1;

  constructor(config) {
    this.config = config;
  }

  /**
   * Stop current output by killing processed and flushing the queue
   */
  stopOutput() {
    // Kill any audible
    return Play.kill();
  }

  /**
   * Destroy current SR stream and detach from mic stream
   */
  destroyRecognizeStream() {
    this.isRecognizing = false;
    this.emitter.emit("notrecognizing");

    if (this.recognizeStream != null) {
      Rec.getStream()?.unpipe(this.recognizeStream);
      this.recognizeStream.destroy();
    }
  }

  /**
   * Create and assign the SR stream by attaching
   * the microphone input to GCP-SR stream
   */
  createRecognizeStream(session: Session) {
    console.log(TAG, "recognizing microphone stream");

    this.recognizeStream = SpeechRecognizer.createRecognizeStream(session.getTranslateFrom(), (err, text) => {
      this.destroyRecognizeStream();

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

    // Every time user speaks, reset the EOR timer to the max
    this.recognizeStream.on("data", (data) => {
      if (data.results.length > 0) {
        this.eorTick = EOR_MAX;
      }
    });

    this.isRecognizing = true;
    this.emitter.emit("recognizing");

    // Pipe current mic stream to SR stream
    Rec.getStream()?.pipe(this.recognizeStream);
  }

  /**
   * Register the global session used by this driver
   */
  async registerInternalSession() {
    return IOManager.registerSession(DRIVER_ID);
  }

  /**
   * Process the EOR ticker
   */
  processEOR() {
    if (this.eorTick === 0) {
      console.info(TAG, "timeout exceeded for conversation");
      this.eorTick = -1;
      this.destroyRecognizeStream();
    } else if (this.eorTick > 0) {
      this.eorTick--;
    }
  }

  /**
   * Register the EOR setInterval ID
   */
  registerEORInterval() {
    if (this.eorInterval) clearInterval(this.eorInterval);
    this.eorInterval = setInterval(this.processEOR.bind(this), 1000);
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
    Play.playURI(`${etcDir}/wake.wav`);

    // Reset any timer variable
    this.wakeWordTick = WAKE_WORD_TICKS;
    this.eorTick = EOR_MAX;

    // Recreate the SRR-stream
    this.createRecognizeStream(session);
  }

  /**
   * Stop the recognizer
   */
  stop() {
    console.info(TAG, "stop");
    this.emitter.emit("stopped");

    this.stopOutput();

    // Reset timer variables
    this.wakeWordTick = -1;
    this.eorTick = -1;

    this.destroyRecognizeStream();
  }

  /**
   * Create and assign the hotword stream to listen for wake word
   */
  createHotwordDetectorStream() {
    // wake();
  }

  async _output(fulfillment: Fulfillment, session: Session): Promise<boolean> {
    this.eorTick = -1; // Temporary disable timer variables

    // If there was a recognizer listener, stop it
    // to avoid that the bot listens to itself
    this.destroyRecognizeStream();

    this.emitter.emit("output", {
      session,
      fulfillment,
    });

    let processed = false;
    const language = fulfillment.payload.language || session.getTranslateTo();

    // Process an Audio
    try {
      if (fulfillment.audio) {
        await Play.playVoice(fulfillment.audio);
        processed = true;
      }
    } catch (err) {
      console.error(TAG, err);
    }

    // Process a text (should be deprecated)
    try {
      if (fulfillment.fulfillmentText && !processed) {
        console.warn(TAG, "using deprecated fulfillmentText instead of using audio");
        const audioFile = await TextToSpeech.getAudioFile(fulfillment.fulfillmentText, language, config().tts.gender);
        await Play.playVoice(audioFile);
        processed = true;
      }
    } catch (err) {
      console.error(TAG, err);
    }

    // Process an Audio Object
    try {
      if (fulfillment.payload.audio) {
        await Play.playURI(fulfillment.payload.audio.uri);
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

    // If that item is not a feedback|welcome, start the recognizer phase again
    // if (!f.payload.feedback && !f.payload.welcome && queueOutput.length === 0) {
    //   eorTick = EOR_MAX;
    //   createRecognizeStream({ session, language: fromLanguage });
    // }

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

    // this.stopOutput(); // Preventive stop any other output
    // Rec.start(); // Power on the mic

    // Start all timers
    // this.createHotwordDetectorStream();
    // this.registerEORInterval();

    Play.playURI(`${etcDir}/boot.wav`, ["vol", "0.2"]);
  }
}

export default new Human(config().human);
