const fs = require("fs");
const request = require("request");
const TelegramBot = require("node-telegram-bot-api");
const Events = require("events");
const bodyParser = require("body-parser");
const config = require("../config");
const Server = require("../stdlib/server");
const IOManager = require("../stdlib/iomanager");
const SR = require("../interfaces/sr");
const TTS = require("../interfaces/tts");
const Play = require("../lib/play");
const Proc = require("../lib/proc");
const { mimicHumanMessage, getAiNameRegex, uuid, rand } = require("../helpers");
const { tmpDir } = require("../paths");

const _config = config.telegram;
const TAG = "IO.Telegram";
const emitter = new Events.EventEmitter();

const bot = new TelegramBot(_config.token, _config.options);

let started = false;
const callbackQuery = {};

/**
 * Handle a voice input by recognizing the text
 * @param {Object} session Current session
 * @param {Object} e Telegram object
 */
async function handleInputVoice(session, e) {
  return new Promise(async resolve => {
    const fileLink = await bot.getFileLink(e.voice.file_id);
    const voiceFile = `${tmpDir}/${uuid()}.ogg`;

    request(fileLink)
      .pipe(fs.createWriteStream(voiceFile))
      .on("close", async () => {
        await Proc.spawn("opusdec", [
          voiceFile,
          `${voiceFile}.wav`,
          "--rate",
          SR.SAMPLE_RATE
        ]);
        const text = await SR.recognizeFile(`${voiceFile}.wav`, {
          convertFile: false,
          language: session.getTranslateFrom()
        });
        resolve(text);
      });
  });
}

/**
 * Send a message to the user
 * @param {String} chatId Chat ID
 * @param {*} text Text to send
 * @param {*} opt Additional bot options
 */
async function sendMessage(
  chatId,
  text,
  opt = {
    parse_mode: "html"
  }
) {
  await bot.sendChatAction(chatId, "typing");
  return bot.sendMessage(chatId, text, opt);
}

/**
 * Send a voice message to the user
 * @param {*} chatId Telegram Chat ID
 * @param {*} text Text to send
 * @param {*} language Language of sentence
 * @param {*} botOpt Additional Telegram options
 */
async function sendVoiceMessage(chatId, text, language, botOpt = {}) {
  const sentences = mimicHumanMessage(text);
  await bot.sendChatAction(chatId, "record_audio");

  for (const sentence of sentences) {
    const audioFile = await TTS.getAudioFile(sentence, { language });
    const voiceFile = await Play.playVoiceToTempFile(audioFile);
    await bot.sendVoice(chatId, voiceFile, botOpt);
  }
}

/**
 * Start the polling/webhook cycle
 */
function startInput() {
  if (started) return;
  started = true;

  // We could attach the webhook to the Router API or via polling
  if (_config.useRouter && config.serverMode) {
    bot.setWebHook(`${config.server.domain}/io/telegram/bot${_config.token}`);
    Server.routerIO.use("/telegram", bodyParser.json(), (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });
    console.info(TAG, "started", _config);
  } else {
    console.info(TAG, "started via polling", _config);
  }
}

/**
 * Output an object to the user
 * @param {Object} f The item
 * @param {*} session The user session
 */
async function output(f, session) {
  console.info(TAG, "output");
  console.dir(
    {
      f,
      session
    },
    {
      depth: 2
    }
  );

  // Inform observers
  emitter.emit("output", {
    session,
    fulfillment: f
  });

  // This is the Telegram Chat ID used to respond to the user
  const chatId = session.io_data.id;
  const language = f.payload.language || session.getTranslateTo();

  let botOpt = {};

  // If we have replies, set the bot opt to reflect the keyboard
  if (f.payload.replies != null) {
    botOpt = {
      reply_markup: {
        resize_keyboard: true,
        one_time_keyboard: true,
        keyboard: [
          f.payload.replies.map(r => {
            if (typeof r === "string") return r;
            return r.text;
          })
        ]
      }
    };
  }

  // Process a Text Object
  try {
    if (f.text) {
      await sendMessage(chatId, f.text, botOpt);

      if (session.pipe.nextWithVoice) {
        session.savePipe({
          nextWithVoice: false
        });
        await sendVoiceMessage(chatId, f.text, language, botOpt);
      }
      if (f.payload.includeVoice) {
        await sendVoiceMessage(chatId, f.text, language, botOpt);
      }
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a URL Object
  try {
    if (f.payload.url) {
      await bot.sendMessage(chatId, f.payload.url, botOpt);
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Music object
  try {
    if (f.payload.music) {
      if (f.payload.music.spotify) {
        if (f.payload.music.spotify.track) {
          await sendMessage(
            chatId,
            f.payload.music.spotify.track.external_urls.spotify,
            botOpt
          );
        } else if (f.payload.music.spotify.tracks) {
          await sendMessage(
            chatId,
            f.payload.music.spotify.tracks
              .map(e => e.external_urls.spotify)
              .join("\n"),
            botOpt
          );
        } else if (f.payload.music.spotify.album) {
          await sendMessage(
            chatId,
            f.payload.music.spotify.album.external_urls.spotify,
            botOpt
          );
        } else if (f.payload.music.spotify.artist) {
          await sendMessage(
            chatId,
            f.payload.music.spotify.artist.external_urls.spotify,
            botOpt
          );
        } else if (f.payload.music.spotify.playlist) {
          await sendMessage(
            chatId,
            f.payload.music.spotify.playlist.external_urls.spotify,
            botOpt
          );
        }
      } else if (f.payload.music.uri) {
        await sendMessage(chatId, f.payload.music.uri, botOpt);
      }
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Video object
  try {
    if (f.payload.video) {
      if (f.payload.video.uri) {
        await bot.sendChatAction(chatId, "upload_video");
        await bot.sendVideo(chatId, f.payload.video.uri, botOpt);
      } else if (f.payload.video.youtube) {
        await bot.sendMessage(
          chatId,
          `https://www.youtube.com/watch?v=${f.payload.video.youtube.id}`,
          botOpt
        );
      }
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process an Image Object
  try {
    if (f.payload.image) {
      if (f.payload.image.uri) {
        await bot.sendChatAction(chatId, "upload_photo");
        await bot.sendPhoto(chatId, f.payload.image.uri, botOpt);
      }
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process an Audio Object
  try {
    if (f.payload.audio) {
      if (f.payload.audio.uri) {
        await bot.sendChatAction(chatId, "upload_audio");
        await bot.sendAudio(chatId, f.payload.audio.uri, botOpt);
      }
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Voice Object
  try {
    if (f.payload.voice) {
      if (f.payload.voice.uri) {
        await bot.sendChatAction(chatId, "upload_audio");
        const voiceFile = await Play.playVoiceToTempFile(f.payload.voice.uri);
        await bot.sendVoice(chatId, voiceFile, botOpt);
      }
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Document Object
  try {
    if (f.payload.document) {
      if (f.payload.document.uri) {
        await bot.sendChatAction(chatId, "upload_document");
        await bot.sendDocument(chatId, f.payload.document.uri, botOpt);
      }
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // ---- Telegram specific Objects ----

  // Process a Game Object
  try {
    if (f.payload.game) {
      callbackQuery[chatId] = callbackQuery[chatId] || {};
      callbackQuery[chatId][f.payload.game.id] = f.payload.game;
      await bot.sendGame(chatId, f.payload.game.id);
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Sticker Object
  try {
    if (f.payload.sticker) {
      await bot.sendSticker(chatId, rand(f.payload.sticker), botOpt);
    }
  } catch (err) {
    console.error(TAG, err);
  }
}

bot.on("webhook_error", err => {
  console.error(TAG, "webhook error", err);
});

bot.on("message", async e => {
  console.info(TAG, "input");
  console.dir(e, {
    depth: 2
  });

  const sessionId = e.chat.id;
  const chatIsGroup = e.chat.type === "group";

  let alias;
  switch (e.chat.type) {
    case "private":
      alias = `${e.chat.first_name} ${e.chat.last_name}`;
      break;
    default:
      alias = e.chat.title;
      break;
  }

  // Register the session
  const session = await IOManager.registerSession({
    sessionId,
    io_driver: "telegram",
    io_data: e.chat,
    alias
  });

  // Process a Text object
  if (e.text) {
    // If we are in a group, only listen for activators
    if (chatIsGroup && !getAiNameRegex().test(e.text)) {
      console.debug(TAG, "skipping input for missing activator", e.text);
      return false;
    }

    emitter.emit("input", {
      session,
      params: {
        text: e.text
      }
    });
    return true;
  }

  // Process a Voice object
  if (e.voice) {
    try {
      const text = await handleInputVoice(session, e);

      // If we are in a group, only listen for activators
      if (chatIsGroup && !getAiNameRegex().test(e.text)) {
        console.debug(TAG, "skipping input for missing activator", e.text);
        return false;
      }

      // User sent a voice note, respond with a voice note :)
      session.savePipe({
        nextWithVoice: true
      });
      emitter.emit("input", {
        session,
        params: {
          text
        }
      });
    } catch (err) {
      if (chatIsGroup === false) {
        return false;
      }
      if (err.unrecognized) {
        return emitter.emit("input", {
          session: IOManager.globalSession,
          params: {
            event: "io_SR_unrecognized"
          }
        });
      }
      return emitter.emit("input", {
        session: IOManager.globalSession,
        error: err
      });
    }

    return true;
  }

  // Process a Photo Object
  if (e.photo) {
    const photoLink = bot.getFileLink(e.photo[e.photo.length - 1].file_id);
    if (chatIsGroup) return false;

    emitter.emit("input", {
      session,
      params: {
        image: {
          uri: photoLink
        }
      }
    });

    return true;
  }

  emitter.emit("input", {
    session,
    error: {
      unkownInputType: true
    }
  });
  return true;
});

bot.on("callback_query", e => {
  if (e.game_short_name) {
    const user = callbackQuery[e.from.id];
    if (user) {
      if (user[e.game_short_name]) {
        bot.answerCallbackQuery(
          e.id,
          undefined,
          false,
          user[e.game_short_name]
        );
      }
    }
  }
});

module.exports = {
  id: "telegram",
  startInput,
  output,
  emitter
};
