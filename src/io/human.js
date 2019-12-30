const Events = require("events");
// @ts-ignore
// eslint-disable-next-line import/no-extraneous-dependencies
const Snowboy = require("snowboy");
const Rec = require("../lib/rec");
const Hotword = require("../lib/hotword");
const URLManager = require("../lib/urlmanager");
const config = require("../config");
const IOManager = require("../stdlib/iomanager");
const SR = require("../interfaces/sr");
const Play = require("../lib/play");
const { etcDir } = require("../paths");
const TTS = require("../interfaces/tts");
const Messages = require("../lib/messages");

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
let recognizeStream;

/**
 * Stream object created by Snowboy
 */
let hotwordDetectorStream;

/**
 * Queue used for output
 */
let queueOutput = [];

/**
 * ID for setInterval used to check the queue
 */
let queueIntv;

/**
 * Current item processed by the queue
 */
let queueProcessingItem;

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
 * Bind external events to internal procedures
 */
function bindEvents() {
  emitter.on("wake", wake);
  emitter.on("stop", stop);
}

/**
 * Send an audio directly to the speaker
 */
async function sendAudio({ uri }) {
  if (uri) {
    await Play.playURI(uri);
  }
}

/**
 * Send an audio directly to the speaker
 */
async function sendVoice({ uri }) {
  if (uri) {
    await Play.playVoice(uri);
  }
}

/**
 * Send a URL
 * @param {String} url
 */
async function sendURL(url) {
  await URLManager.open(url);
}

/**
 * Stop current output by killing processed and flushing the queue
 */
function stopOutput() {
  // Kill any audible
  Play.kill();

  // Reset the current processed items
  queueProcessingItem = null;

  // Empty the queue
  queueOutput = [];
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
 * Register the EOR setInterval ID
 */
function registerEORInterval() {
  if (eorInterval) clearInterval(eorInterval);
  eorInterval = setInterval(processEOR, 1000);
}

/**
 * Register the Queue setInterval ID
 */
function registerOutputQueueInterval() {
  if (queueIntv) clearInterval(queueIntv);
  queueIntv = setInterval(processOutputQueue, 1000);
}

/**
 * Wake the bot and listen for intents
 */
async function wake() {
  const session = await registerInternalSession();
  const language = await session.getTranslateFrom();

  console.info(TAG, "wake");
  emitter.emit("woken");

  // Stop any previous output
  stopOutput();

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
 * Process the item in the output queue
 */
async function processOutputQueue() {
  // Do not process if no item in the queue
  if (queueOutput.length === 0) return;

  // Do not process if already processing
  if (queueProcessingItem != null) return;

  // Always ensure that there is the session
  const session = await registerInternalSession();

  // Grab the first item in the queue
  const f = queueOutput[0];

  // Temporary disable timer variables
  eorTick = -1;

  // Set the current queue item to process
  queueProcessingItem = f;

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
      const audioFile = await TTS.getAudioFile(
        `${Messages.get("deprecated_using_fulfillment_text")}${f.text}`,
        {
          language
        }
      );
      await Play.playVoice(audioFile);
      processed = true;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a URL
  try {
    if (f.payload.url) {
      await sendURL(f.payload.url);
      processed = true;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Music object
  try {
    if (f.payload.music) {
      processed = false;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Video object
  try {
    if (f.payload.video) {
      processed = false;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process an Audio Object
  try {
    if (f.payload.audio) {
      await sendAudio(f.payload.audio);
      processed = true;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Voice object
  try {
    if (f.payload.voice) {
      await sendVoice(f.payload.voice);
      processed = true;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Document Object
  try {
    if (f.payload.document) {
      processed = false;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  if (!processed) {
    const audioFile = await TTS.getAudioFile(
      Messages.get("error_payload_not_recognized"),
      {
        language
      }
    );
    await Play.playVoice(audioFile);
  }

  // Reset current processed item and shift that item in the queue
  queueProcessingItem = null;
  queueOutput.shift();

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
}

/**
 * Start the session
 */
async function startInput() {
  console.debug(TAG, "start input", _config);

  // Ensure session is present
  const session = await registerInternalSession();

  // Preventive stop any other output
  await stopOutput();

  // Start all timers
  hotwordModels = await Hotword.getModels();

  // Power on the mic
  Rec.start();

  // Start all timers
  createHotwordDetectorStream({ session });
  registerOutputQueueInterval();
  registerEORInterval();
}

/**
 * Stop the mic
 */
async function stopInput() {
  Rec.stop();
}

/**
 * Output an item
 * @param {Object} f
 */
async function output(f) {
  // Ensure session is present
  await registerInternalSession();

  // Just push onto the queue, and let the queue process
  queueOutput.push(f);
}

Play.playURI(`${etcDir}/boot.wav`, [], 1);

bindEvents();

module.exports = {
  id: "human",
  startInput,
  stopInput,
  output,
  emitter
};
