const TAG = 'IO.Kid';

// Header
exports.config = {
  id: 'kid',
};

const _config = config.kid;

const md5 = require('md5');
const emitter = (exports.emitter = new (require('events')).EventEmitter());

const Rec = apprequire('rec');
const SR = requireInterface('sr');
const TTS = requireInterface('tts');
const Play = apprequire('play');
const Snowboy = requireOrNull('snowboy');
const Hotword = apprequire('hotword');
const URLManager = apprequire('urlmanager');

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
 * An hash that represents current spoken message
 */
let currentSendMessageKey = null;

/**
 * Bind external events to internal procedures
 */
function bindEvents() {
  emitter.on('wake', wake);
  emitter.on('stop', stop);

  emitter.on('loaded', () => {
    Play.playURI(`${__etcdir}/boot.wav`);
  });
}

/**
 * Speak a sentence
 * @param {string} text String to speak
 * @param {string} language Language of text
 */
async function sendMessage(
  text,
  { language = IOManager.session.getTranslateTo() },
) {
  const key = md5(text);
  currentSendMessageKey = key;

  const sentences = mimicHumanMessage(text);

  for (const sentence of sentences) {
    if (currentSendMessageKey === key) {
      const audioFile = await TTS.getAudioFile(sentence, {
        language,
      });
      await Play.playVoice(audioFile);
    }
  }

  return true;
}

/**
 * Map event strings to procedures and process them
 * @param {string} event
 */
async function processEvent(event) {
  switch (event) {
    case 'hotword_recognized_first_hint':
      eorTick = EOR_MAX;
      createRecognizeStream();
      break;
  }
}

/**
 * Send an audio directly to the speaker
 * @param {Object} e
 */
async function sendAudio(e) {
  if (e.uri) {
    await Play.playURI(e.uri);
  }
}

/**
 * Send an audio directly to the speaker
 * @param {Object} e
 */
async function sendVoice(e) {
  if (e.uri) {
    await Play.playVoice(e.uri);
  }
}

/**
 * Send a URL
 * @param {String} e
 */
async function sendURL(e) {
  await URLManager.open(e);
}

/**
 * Stop current output by killing processed and flushing the queue
 */
function stopOutput() {
  // Kill any audible
  Play.kill();

  // Reset the current processed items
  currentSendMessageKey = null;
  queueProcessingItem = null;

  // Empty the queue
  queueOutput = [];
}

/**
 * Destroy current SR stream and detach from mic stream
 */
function destroyRecognizeStream() {
  isRecognizing = false;
  emitter.emit('notrecognizing');

  if (recognizeStream != null) {
    Rec.getStream().unpipe(recognizeStream);
    recognizeStream.destroy();
  }
}

/**
 * Create and assign the SR stream by attaching
 * the microphone input to GCP-SR stream
 */
function createRecognizeStream(
  language = IOManager.session.getTranslateFrom(),
) {
  console.log(TAG, 'recognizing microphone stream');

  recognizeStream = SR.createRecognizeStream(
    {
      language,
    },
    (err, text) => {
      destroyRecognizeStream();

      // If erred, emit an error and exit
      if (err) {
        if (err.unrecognized) {
          return;
        }
        emitter.emit('input', {
          error: err,
        });
        return;
      }

      // Otherwise, emit an INPUT message with the recognized text
      emitter.emit('input', {
        params: {
          text,
        },
      });
    },
  );

  // Every time user speaks, reset the EOR timer to the max
  recognizeStream.on('data', (data) => {
    if (data.results.length > 0) {
      eorTick = EOR_MAX;
    }
  });

  isRecognizing = true;
  emitter.emit('recognizing');

  // Pipe current mic stream to SR stream
  Rec.getStream().pipe(recognizeStream);
  return recognizeStream;
}

/**
 * Register the global session used by this driver
 */
async function registerGlobalSession() {
  return IOManager.registerSession({
    sessionId: null, // act as a global session
    io_driver: 'kid',
    io_data: {},
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
function wake() {
  if (IOManager.session == null) {
    console.error(TAG, 'called wake prematurely');
    return;
  }

  console.info(TAG, 'wake');
  emitter.emit('woken');

  // Stop any previous output
  stopOutput();

  // Play a recognizable sound
  Play.playURI(`${__etcdir}/wake.mp3`);

  // Reset any timer variable
  wakeWordTick = WAKE_WORD_TICKS;
  eorTick = EOR_MAX;

  // Recreate the SRR-stream
  destroyRecognizeStream();
  createRecognizeStream();
}

/**
 * Stop the recognizer
 */
function stop() {
  if (IOManager.session == null) {
    console.error(TAG, 'called stop prematurely');
    return;
  }

  console.info(TAG, 'stop');
  emitter.emit('stopped');

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
  if (Snowboy == null) {
    console.error(TAG, 'Unable to create hotword detector');
    return;
  }

  hotwordDetectorStream = new Snowboy.Detector({
    resource: `${__etcdir}/common.res`,
    models: hotwordModels,
    audioGain: 1.0,
  });

  hotwordDetectorStream.on('hotword', async (index, hotword, buffer) => {
    console.log(TAG, 'hotword', hotword);
    switch (hotword) {
      case 'wake':
        wake();
        break;
      default:
        break;
			// case 'stop':
			// stop();
			// break;
    }
  });

  hotwordDetectorStream.on('silence', async () => {
    if (!isRecognizing) return;
    if (wakeWordTick === -1) return;

    wakeWordTick--;
    if (wakeWordTick === 0) {
      wakeWordTick = -1;
      console.info(
        TAG,
        `detected ${WAKE_WORD_TICKS} ticks of consecutive silence, prompt user`,
      );
      destroyRecognizeStream();
      emitter.emit('input', {
        params: {
          event: 'hotword_recognized_first_hint',
        },
      });
    }
  });

  // When user shout, reset the wakeWordTick to restart the count
  hotwordDetectorStream.on('sound', (buffer) => {
    wakeWordTick = -1;
  });

  hotwordDetectorStream.on('error', (err) => {
    console.error(TAG, 'Hotword error', err);
  });

  // Get the mic stream and pipe to the hotword stream
  Rec.getStream().pipe(hotwordDetectorStream);

  return hotwordDetectorStream;
}

/**
 * Process the EOR ticker
 */
function processEOR() {
  if (eorTick == 0) {
    console.info(TAG, 'timeout exceeded for conversation');
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
  if (IOManager.session == null) return;
  const { session } = IOManager;

  // Grab the first item in the queue
  const f = queueOutput[0];

  // Temporary disable timer variables
  eorTick = -1;

  // Set the current queue item to process
  queueProcessingItem = f;

  // If there was a recognizer listener, stop it
  // to avoid that the bot listens to itself
  destroyRecognizeStream();

  emitter.emit('output', {
    session,
    fulfillment: f,
  });

  // Process a Text
  try {
    if (f.fulfillmentText) {
      await sendMessage(f.fulfillmentText, {
        language: f.payload.language,
      });
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a URL
  try {
    if (f.payload.url) {
      await sendURL(f.payload.url);
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Music object
  try {
    if (f.payload.music) {
      // TODO
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Video object
  try {
    if (f.payload.video) {
      // TODO
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process an Audio Object
  try {
    if (f.payload.audio) {
      await sendAudio(f.payload.audio);
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Voice object
  try {
    if (f.payload.voice) {
      await sendVoice(f.payload.voice);
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Document Object
  try {
    if (f.payload.document) {
      // TODO
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Lyrics object
  try {
    if (f.payload.lyrics) {
      await sendMessage(f.payload.lyrics.text, f.payload.lyrics.language);
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Reset current processed item and shift that item in the queue
  queueProcessingItem = null;
  queueOutput.shift();

  if (f.payload.feedback) {
    emitter.emit('thinking');
  }

  if (f.payload.welcome) {
    emitter.emit('stop');
  }

  // If that item is not a feedback|welcome, start the recognizer phase again
  if (!f.payload.feedback && !f.payload.welcome && queueOutput.length === 0) {
    eorTick = EOR_MAX;
    createRecognizeStream();
  }
}

/**
 * Start the session
 */
exports.startInput = async () => {
  console.debug(TAG, 'start input');

  // Ensure session is present
  const session = await registerGlobalSession();

  // Preventive stop any other output
  await stopOutput();

  // Emit the initial event to inform
  // the user that the bot is ready
  // emitter.emit('input', {
  // 	params: {
  // 		event: {
  // 			name: 'welcome',
  // 			data: {
  // 				name: session.alias || config.uid
  // 			}
  // 		}
  // 	}
  // });

  // Start all timers
  hotwordModels = await Hotword.getModels();

  // Power on the mic
  Rec.start();

  // Start all timers
  createHotwordDetectorStream();
  registerOutputQueueInterval();
  registerEORInterval();
};

/**
 * Stop the mic
 */
exports.stopInput = async () => {
  Rec.stop();
};

/**
 * Output an item
 * @param {Object} f
 */
exports.output = async (f) => {
  console.debug(TAG, 'output');
  console.dir(f, {
    depth: 10,
  });

  // Ensure session is present
  await registerGlobalSession();

  // Just push onto the queue, and let the queue process
  queueOutput.push(f);
};

// Bind events
bindEvents();
