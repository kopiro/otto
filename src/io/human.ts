import Events from "events";
import * as Rec from "../lib/rec";
import config from "../config";
import * as IOManager from "../stdlib/iomanager";
import * as SR from "../interfaces/sr";
import * as Play from "../lib/play";
import { etcDir } from "../paths";
import * as TTS from "../interfaces/tts";
import { timeout } from "../helpers";
import { Fulfillment, Session } from "../types";

// eslint-disable-next-line no-unused-vars
const TAG = "IO.Human";
const DRIVER_ID = "human";

export const emitter = new Events.EventEmitter();

/**
 * TRUE when the audio is recording and it's submitting to GCP-SR
 */
let isRecognizing = false;

/**
 * Stream object created by GCP-SR
 */
let recognizeStream = null;

/**
 * Current item processed by the queue
 */
let currentSpokenFulfillment = null;

/**
 * When the wake word has been detected,
 * wait an amount of ticks defined by this constant
 * after that user should be prompted by voice
 */
const WAKE_WORD_TICKS = 6;

/**
 * Tick used by WAKE_WORDS_TICKS
 */
let wakeWordTick = -1;

/**
 * Number of seconds of silence after that
 * user should proununce wake word again to activate te SR
 */
const EOR_MAX = 8;

/**
 * ID for setInterval used by EOR_MAX
 */
let eorInterval = null;

/**
 * Tick used by EOR_MAX
 */
let eorTick = -1;

/**
 * Stop current output by killing processed and flushing the queue
 */
function stopOutput() {
  // Kill any audible
  Play.kill();
}

/**
 * Destroy current SR stream and detach from mic stream
 */
function destroyRecognizeStream() {
  isRecognizing = false;
  emitter.emit("notrecognizing");

  if (recognizeStream != null) {
    Rec.getStream().unpipe(recognizeStream);
    recognizeStream.destroy();
  }
}

/**
 * Create and assign the SR stream by attaching
 * the microphone input to GCP-SR stream
 */
function createRecognizeStream(session: Session) {
  console.log(TAG, "recognizing microphone stream");

  recognizeStream = SR.createRecognizeStream(session.getTranslateFrom(), (err, text) => {
    destroyRecognizeStream();

    // If erred, emit an error and exit
    if (err) {
      if (err.unrecognized) {
        return;
      }
      emitter.emit("input", {
        session,
        error: err,
      });
      return;
    }

    // Otherwise, emit an INPUT message with the recognized text
    emitter.emit("input", {
      session,
      params: {
        text,
      },
    });
  });

  // Every time user speaks, reset the EOR timer to the max
  recognizeStream.on("data", data => {
    if (data.results.length > 0) {
      eorTick = EOR_MAX;
    }
  });

  isRecognizing = true;
  emitter.emit("recognizing");

  // Pipe current mic stream to SR stream
  Rec.getStream().pipe(recognizeStream);
  return recognizeStream;
}

/**
 * Register the global session used by this driver
 */
async function registerInternalSession() {
  return IOManager.registerSession(DRIVER_ID);
}

/**
 * Process the EOR ticker
 */
function processEOR() {
  if (eorTick === 0) {
    console.info(TAG, "timeout exceeded for conversation");
    eorTick = -1;
    destroyRecognizeStream();
  } else if (eorTick > 0) {
    eorTick--;
  }
}

/**
 * Register the EOR setInterval ID
 */
function registerEORInterval() {
  if (eorInterval) clearInterval(eorInterval);
  eorInterval = setInterval(processEOR, 1000);
}

/**
 * Wake the bot and listen for intents
 */
async function wake() {
  const session = await registerInternalSession();

  console.info(TAG, "wake");
  emitter.emit("woken");

  stopOutput(); // Stop any previous output

  // Play a recognizable sound
  Play.playURI(`${etcDir}/wake.wav`);

  // Reset any timer variable
  wakeWordTick = WAKE_WORD_TICKS;
  eorTick = EOR_MAX;

  // Recreate the SRR-stream
  destroyRecognizeStream();
  createRecognizeStream(session);
}

/**
 * Stop the recognizer
 */
function stop() {
  console.info(TAG, "stop");
  emitter.emit("stopped");

  stopOutput();

  // Reset timer variables
  wakeWordTick = -1;
  eorTick = -1;

  destroyRecognizeStream();
}

/**
 * Create and assign the hotword stream to listen for wake word
 */
function createHotwordDetectorStream() {
  // wake();
}

/**

 */
async function _output(f, session) {
  eorTick = -1; // Temporary disable timer variables

  // If there was a recognizer listener, stop it
  // to avoid that the bot listens to itself
  destroyRecognizeStream();

  emitter.emit("output", {
    session,
    fulfillment: f,
  });

  let processed = false;
  const language = f.payload.language || session.getTranslateTo();

  // Process an Audio
  try {
    if (f.audio) {
      await Play.playVoice(f.audio);
      processed = true;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a text (should be deprecated)
  try {
    if (f.text && !processed) {
      const audioFile = await TTS.getAudioFile(f.text, language, config().tts.gender);
      await Play.playVoice(audioFile);
      processed = true;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process an Audio Object
  try {
    if (f.payload.audio) {
      await Play.playURI(f.payload.audio);
      processed = true;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  if (f.payload.feedback) {
    emitter.emit("thinking");
  }

  if (f.payload.welcome) {
    emitter.emit("stop");
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
export async function output(fulfillment: Fulfillment, session: Session) {
  // If we have a current processed item, let's wait until it's null
  while (currentSpokenFulfillment) {
    console.log(TAG, "waiting until agent is not speaking");
    // eslint-disable-next-line no-await-in-loop
    await timeout(500);
  }

  currentSpokenFulfillment = fulfillment;

  try {
    return _output(fulfillment, session);
  } finally {
    currentSpokenFulfillment = null;
  }
}

/**
 * Start the session
 */
export async function start() {
  // Ensure session is present
  const session = await registerInternalSession();
  console.log(TAG, "started", session);

  stopOutput(); // Preventive stop any other output
  Rec.start(); // Power on the mic

  // Start all timers
  createHotwordDetectorStream();
  registerEORInterval();

  // Play.playURI(`${etcDir}/boot.wav`, ["-v", 0.4], 1);
}

emitter.on("wake", wake);
emitter.on("stop", stop);
