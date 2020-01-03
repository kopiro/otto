const Events = require("events");
// @ts-ignore
// eslint-disable-next-line import/no-extraneous-dependencies
const Snowboy = require("snowboy");
const Rec = require("../lib/rec");
const Hotword = require("../lib/hotword");
const config = require("../config");
const IOManager = require("../stdlib/iomanager");
const SR = require("../interfaces/sr");
const Play = require("../lib/play");
const { etcDir } = require("../paths");
const TTS = require("../interfaces/tts");
const { timeout } = require("../helpers");

// eslint-disable-next-line no-unused-vars
const _config = config.human;
const TAG = "IO.Human";
const emitter = new Events.EventEmitter();

/**
 * TRUE when the audio is recording and it's submitting to GCP-SR
 */
let isRecognizing = false;

/**
 * Stream object created by GCP-SR
 */
let recognizeStream = null;

/**
 * Stream object created by Snowboy
 */
let hotwordDetectorStream = null;

/**
 * Current item processed by the queue
 */
let currentItem = null;

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
 * Models used by snowboy for hotword detection
 */
let hotwordModels = null;

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
function createRecognizeStream({ session, language }) {
  console.log(TAG, "recognizing microphone stream");

  recognizeStream = SR.createRecognizeStream(
    {
      language
    },
    (err, text) => {
      destroyRecognizeStream();

      // If erred, emit an error and exit
      if (err) {
        if (err.unrecognized) {
          return;
        }
        emitter.emit("input", {
          session,
          error: err
        });
        return;
      }

      // Otherwise, emit an INPUT message with the recognized text
      emitter.emit("input", {
        session,
        params: {
          text
        }
      });
    }
  );

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
  return IOManager.registerSession({
    ioDriver: "human"
  });
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
  const language = session.getTranslateFrom();

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
  createRecognizeStream({ session, language });
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
function createHotwordDetectorStream({ session }) {
  hotwordDetectorStream = new Snowboy.Detector({
    resource: `${etcDir}/common.res`,
    models: hotwordModels,
    audioGain: 1.0
  });

  hotwordDetectorStream.on("hotword", async (index, hotword) => {
    console.log(TAG, "hotword", hotword);
    switch (hotword) {
      case "wake":
        wake();
        break;
      default:
        break;
      // case 'stop':
      // stop();
      // break;
    }
  });

  hotwordDetectorStream.on("silence", async () => {
    if (!isRecognizing) return;
    if (wakeWordTick === -1) return;

    wakeWordTick--;
    if (wakeWordTick === 0) {
      wakeWordTick = -1;
      console.info(
        TAG,
        `detected ${WAKE_WORD_TICKS} ticks of consecutive silence, prompt user`
      );
      destroyRecognizeStream();
      emitter.emit("input", {
        session,
        params: {
          event: "hotword_recognized_first_hint"
        }
      });
    }
  });

  // When user shout, reset the wakeWordTick to restart the count
  hotwordDetectorStream.on("sound", () => {
    wakeWordTick = -1;
  });

  hotwordDetectorStream.on("error", err => {
    console.error(TAG, "Hotword error", err);
  });

  // Get the mic stream and pipe to the hotword stream
  Rec.getStream().pipe(hotwordDetectorStream);

  return hotwordDetectorStream;
}

/**
 *
 * @param {Object} f
 * @param {Object} session
 */
async function _output(f, session) {
  eorTick = -1; // Temporary disable timer variables

  // If there was a recognizer listener, stop it
  // to avoid that the bot listens to itself
  destroyRecognizeStream();

  emitter.emit("output", {
    session,
    fulfillment: f
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
      const audioFile = await TTS.getAudioFile(f.text, {
        language
      });
      await Play.playVoice(audioFile);
      processed = true;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process an Audio Object
  try {
    if (f.payload.audio) {
      await Play.playAudio(f.payload.audio);
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
 * @param {Object} f
 * @param {Object} session
 */
async function output(f, session) {
  // If we have a current processed item, let's wait until it's null
  while (currentItem) {
    console.log(TAG, "waiting 500ms until agent is not speaking", currentItem);
    // eslint-disable-next-line no-await-in-loop
    await timeout(500);
  }

  let result;
  let err;

  currentItem = f;

  try {
    result = await _output(f, session);
  } catch (e) {
    err = e;
  }

  currentItem = null;
  if (err) {
    throw err;
  }

  return result;
}

/**
 * Start the session
 */
async function start() {
  // Ensure session is present
  const session = await registerInternalSession();

  stopOutput(); // Preventive stop any other output
  Rec.start(); // Power on the mic

  // Start all timers
  hotwordModels = await Hotword.getModels();
  createHotwordDetectorStream({ session });
  registerEORInterval();

  Play.playURI(`${etcDir}/boot.wav`, [], 1);
}

emitter.on("wake", wake);
emitter.on("stop", stop);

module.exports = {
  id: "human",
  start,
  output,
  emitter
};
