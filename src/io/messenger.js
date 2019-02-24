const TAG = 'IO.Messenger';
exports.config = {
  id: 'messenger',
  onlyServerMode: true,
};

const _config = config.messenger;

const _ = require('underscore');
const fs = require('fs');
const request = require('request');

const emitter = (exports.emitter = new (require('events')).EventEmitter());

const Server = apprequire('server');
const MessengerBot = require('messenger-bot');

const Play = apprequire('play');

/**
 * Messenger bot Client
 */
const bot = new MessengerBot(_config);

let started = false;

/**
 * Send a message to the user
 * @param {String} chat_id	Chat ID
 * @param {*} text Text to send
 * @param {*} opt Additional bot options
 */
async function sendMessage(chat_id, text, opt = {}) {
  await bot.sendSenderAction(chat_id, 'typing');

  _.defaults(opt, {
    parse_mode: 'html',
  });

  bot.sendMessage(chat_id, text, opt);
}

/**
 * Start the polling/webhook cycle
 */
exports.startInput = function () {
  if (started === true) return;
  started = true;

  // Attach to the server
  if (config.serverMode == true) {
    Server.routerIO.use('/messenger', bot.middleware());
    console.info(TAG, 'started');
  } else {
    console.error(
      TAG,
      'unable to start in client mode; enable serverMode in config',
    );
  }
};

/**
 * Output an object to the user
 * @param {Object} f	The item
 * @param {*} session The user session
 */
exports.output = async function (f, session) {
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

  const chat_id = session.io_data.sender.id;
  const language = f.payload.language || session.getTranslateTo();

  let bot_opt = {};

  // If we have replies, set the bot opt to reflect the keyboard
  if (f.payload.replies) {
    bot_opt = {
      quick_replies: f.payload.replies.map((r) => {
        if (_.isString(r)) {
          r = {
            id: r,
            text: r,
          };
        }
        return {
          title: r.text,
          data: r.id,
          content_type: 'text',
        };
      }),
    };
  }

  // Process a Text Object
  try {
    if (f.fulfillmentText) {
      await sendMessage(chat_id, f.fulfillmentText, bot_opt);
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a URL Object
  try {
    if (f.payload.url) {
      await bot.sendMessage(chat_id, f.payload.url, bot_opt);
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
            chat_id,
            f.payload.music.spotify.track.external_urls.spotify,
            bot_opt,
          );
        }
        if (f.payload.music.spotify.album) {
          await sendMessage(
            chat_id,
            f.payload.music.spotify.album.external_urls.spotify,
            bot_opt,
          );
        }
        if (f.payload.music.spotify.artist) {
          await sendMessage(
            chat_id,
            f.payload.music.spotify.artist.external_urls.spotify,
            bot_opt,
          );
        }
        if (f.payload.music.spotify.playlist) {
          await sendMessage(
            chat_id,
            f.payload.music.spotify.playlist.external_urls.spotify,
            bot_opt,
          );
        }
      } else if (f.payload.music.uri) {
        await sendMessage(chat_id, f.payload.music.uri, bot_opt);
      }
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Video object
  try {
    if (f.payload.video) {
      if (f.payload.video.uri) {
        await bot.sendSenderAction(chat_id, 'upload_video');
        await bot.sendVideo(chat_id, f.payload.video.uri, bot_opt);
      } else if (f.payload.video.youtube) {
        await bot.sendMessage(
          chat_id,
          `https://www.youtube.com/watch?v=${f.payload.video.youtube.id}`,
          bot_opt,
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
        await bot.sendSenderAction(chat_id, 'upload_photo');
        await bot.sendPhoto(chat_id, f.payload.image.uri, bot_opt);
      }
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process an Audio Object
  try {
    if (f.payload.audio) {
      if (f.payload.audio.uri) {
        await bot.sendSenderAction(chat_id, 'upload_audio');
        await bot.sendAudio(chat_id, f.payload.audio.uri, bot_opt);
      }
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Voice Object
  try {
    if (f.payload.voice) {
      if (f.payload.voice.uri) {
        await bot.sendSenderAction(chat_id, 'upload_audio');
        const voice_file = await Play.playVoiceToTempFile(f.payload.voice.uri);
        await bot.sendVoice(chat_id, voice_file, bot_opt);
      }
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Document Object
  try {
    if (f.payload.document) {
      if (f.payload.document.uri) {
        await bot.sendSenderAction(chat_id, 'upload_document');
        await bot.sendDocument(chat_id, f.payload.document.uri, bot_opt);
      }
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Lyrics object
  try {
    if (f.payload.lyrics) {
      await sendMessage(chat_id, f.payload.lyrics.text, bot_opt);
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // ---- Messenger specific options ----
};

bot.on('error', (err) => {
  console.error(TAG, 'webhook error', err);
});

bot.on('message', (e) => {
  console.info(TAG, 'input');
  console.dir(e, {
    depth: 2,
  });

  const sessionId = e.sender.id;

  bot.getProfile(sessionId, async (err, profile) => {
    if (err) {
      console.error(TAG, 'unable to get profile', err);
      return;
    }

    // Register the session
    const session = await IOManager.registerSession({
      sessionId,
      io_driver: 'messenger',
      io_data: {
        profile,
        sender: e.sender,
      },
      alias: `${profile.first_name} ${profile.last_name}`,
    });

    const chat_id = session.io_data.sender.id;

    // Set this message as seen
    bot.sendSenderAction(chat_id, 'mark_seen');

    // Process a Text object
    if (e.message.text) {
      emitter.emit('input', {
        session,
        params: {
          text: e.message.text,
        },
      });
      return;
    }

    // Process Attachments
    if (e.message.attachments && e.message.attachments[0].type === 'image') {
      const attach = e.message.attachments[0];
      emitter.emit('input', {
        session,
        params: {
          image: {
            uri: attach.payload.url,
          },
        },
      });
      return;
    }

    emitter.emit('input', {
      session,
      error: {
        unkownInputType: true,
      },
    });
  });
});
