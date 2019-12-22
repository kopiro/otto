const path = require("path");
const Events = require("events");
const Play = require("../lib/play");
const SR = require("../interfaces/sr");
const TTS = require("../interfaces/tts");
const Server = require("../stdlib/server");
const IOManager = require("../stdlib/iomanager");
const { tmpDir } = require("../paths");
const { uuid } = require("../helpers");

const TAG = "IO.Web";
const emitter = new Events.EventEmitter();

/**
 * True when startInput has been called
 */
let started = false;

/**
 * Process an input request by Express
 */
async function handleRequest(session, e) {
  if (e.text) {
    emitter.emit("input", {
      session,
      params: {
        text: e.text
      }
    });
  } else if (e.audio) {
    const text = await SR.recognizeBuffer(e.audio, {
      language: session.getTranslateFrom()
    });
    emitter.emit("input", {
      session,
      params: {
        text
      }
    });
  } else {
    throw new Error("Unable to understand your request");
  }
}

function configureSocket(socket) {
  socket.on("input", async e => {
    try {
      if (e.sessionId == null) {
        throw new Error("Invalid session identifier");
      }

      console.info(TAG, "request", e);

      // Register the session
      const session = await IOManager.registerSession({
        sessionId: e.sessionId,
        ioDriver: "web",
        ioData: e
      });

      session.io_data_web = {
        socket,
        e
      };

      socket.emit("typing");

      try {
        await handleRequest(session, e);
      } catch (err) {
        console.error(TAG, err);
        emitter.emit("input", {
          session,
          error: err
        });
      }
    } catch (err) {
      emitter.emit("output", {
        error: err
      });
    }
  });
}

/**
 * Start the polling/webhook cycle
 */
function startInput() {
  if (started) return;
  started = true;

  Server.io.on("connection", socket => {
    console.log(TAG, "Someone connected via socket");
    configureSocket(socket);
  });

  console.info(TAG, "started");
}

/**
 * Output an object to the user
 * @param {Object} f The item
 * @param {*} session The user session
 */
async function output(f, session) {
  const request = session.io_data_web;
  if (request == null) {
    throw new Error("Invalid data found in session");
  }

  // Inform observers
  emitter.emit("output", {
    session,
    fulfillment: f
  });

  // Process voice if output type set
  if (request.e.outputType === "voice") {
    const speech = f.fulfillmentText;
    const language = f.payload.language || session.getTranslateTo();

    if (speech != null) {
      const outputFile = path.join(tmpDir, `${uuid()}.mp3`);
      await Play.playVoiceToFile(
        await TTS.getAudioFile(speech, {
          language
        }),
        outputFile
      );
      f.voice = Server.getAbsoluteURIByRelativeURI(
        `/tmp/${path.basename(outputFile)}`
      );
    }
  }

  return request.socket.emit("output", f);
}

module.exports = {
  id: "web",
  onlyServerMode: true,
  startInput,
  output,
  emitter
};
