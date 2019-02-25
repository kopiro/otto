const TAG = 'IO.Web';

exports.config = {
  id: 'web',
  onlyServerMode: true,
};

const _config = config.web;

const emitter = (exports.emitter = new (require('events')).EventEmitter());
const path = require('path');

const Play = requireLibrary('play');
const SR = requireInterface('sr');
const TTS = requireInterface('tts');
const Server = requireLibrary('server');

/**
 * True when startInput has been called
 */
let started = false;

/**
 * Process an input request by Express
 * @param {Object} req
 * @param {Object} res
 */
async function handleRequest(session, e) {
  if (e.text) {
    emitter.emit('input', {
      session,
      params: {
        text: e.text,
      },
    });
  } else if (e.audio) {
    const text = await SR.recognizeBuffer(e.audio, {
      language: session.getTranslateFrom(),
    });
    emitter.emit('input', {
      session,
      params: {
        text,
      },
    });
  } else {
    throw new Error('Unable to understand your request');
  }
}

function configureSocket(socket) {
  socket.on('input', async (e) => {
    try {
      if (e.sessionId == null) {
        throw new Error('Invalid session identifier');
      }

      console.info(TAG, 'request', e);

      // Register the session
      const session = await IOManager.registerSession({
        sessionId: e.sessionId,
        io_driver: 'web',
        io_data: e,
      });

      session.io_data_web = {
        socket,
        e,
      };

      socket.emit('typing');

      try {
        await handleRequest(session, e);
      } catch (err) {
        console.error(TAG, err);
        emitter.emit('input', {
          session,
          error: err,
        });
      }
    } catch (err) {
      emitter.emit('output', {
        error: err,
      });
    }
  });
}

/**
 * Start the polling/webhook cycle
 */
exports.startInput = function () {
  if (started) return;
  started = true;

  Server.io.on('connection', (socket) => {
    console.log(TAG, 'Someone connected via socket');
    configureSocket(socket);
  });

  console.info(TAG, 'started');
};

/**
 * Output an object to the user
 * @param {Object} f	The item
 * @param {*} session The user session
 */
exports.output = async function (f, session) {
  const request = session.io_data_web;
  if (request == null) {
    throw new Error('Invalid data found in session');
  }

  console.info(TAG, 'output');
  console.dir(
    {
      f,
      session,
    },
    {
      depth: 2,
    },
  );

  // Inform observers
  emitter.emit('output', {
    session,
    fulfillment: f,
  });

  // Process voice if output type set
  if (request.e.outputType === 'voice') {
    const speech = f.fulfillmentText;
    const language = f.payload.language || session.getTranslateTo();

    if (speech != null) {
      const output_file = path.join(__tmpdir, `${uuid()}.mp3`);
      await Play.playVoiceToFile(
        await TTS.getAudioFile(speech, {
          language,
        }),
        output_file,
      );
      f.voice = Server.getAbsoluteURIByRelativeURI(
        `/tmp/${path.basename(output_file)}`,
      );
    }
  }

  return request.socket.emit('output', f);
};
