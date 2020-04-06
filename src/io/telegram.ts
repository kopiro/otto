import fs from "fs";
import path from "path";
import request from "request";
import TelegramBot from "node-telegram-bot-api";
import Events from "events";
import bodyParser from "body-parser";
import config from "../config";
import * as Server from "../stdlib/server";
import * as IOManager from "../stdlib/iomanager";
import * as SR from "../interfaces/sr";
import * as TTS from "../interfaces/tts";
import * as Play from "../lib/play";
import * as Proc from "../lib/proc";
import { v4 as uuid } from "uuid";
import { tmpDir } from "../paths";
import { Fulfillment, Session } from "../types";
import { getAiNameRegex } from "../helpers";

const _config = config().telegram;
const TAG = "IO.Telegram";
export const emitter = new Events.EventEmitter();

const bot: TelegramBot = new TelegramBot(_config.token, _config.options);

let botMe: TelegramBot.User;
let botMentionRegex: RegExp;

let started = false;
const callbackQuery = {};

export const id = "telegram";

/**
 * Handle a voice input by recognizing the text
 */
async function handleInputVoice(e: TelegramBot.Message, session: Session): Promise<string> {
  return new Promise(async (resolve) => {
    const fileLink = await bot.getFileLink(e.voice.file_id);
    const voiceFile = path.join(tmpDir, `${uuid()}.ogg`);
    const voiceWavFile = `${voiceFile}.wav`;

    request(fileLink)
      .pipe(fs.createWriteStream(voiceFile))
      .on("close", async () => {
        await Proc.spawn("opusdec", [voiceFile, voiceWavFile, "--rate", SR.SAMPLE_RATE]);
        const text = await SR.recognizeFile(voiceWavFile, session.getTranslateFrom(), false);
        resolve(text);
      });
  });
}

/**
 * Remove any XML tag
 */
function cleanOutputText(text: string) {
  return text.replace(/<[^>]+>/g, "");
}

/**
 * Split a text using a pattern to mimic a message sent by a human
 */
export function mimicHumanMessage(text: string): Array<string> {
  return cleanOutputText(text)
    .split(/\\n|\n|\.(?=\s+|[A-Z])/)
    .filter((e) => e.length > 0);
}

function cleanInputText(e: TelegramBot.Message) {
  let text = e.text;
  text = text.replace(`@${botMe.username}`, "");
  return text;
}

/**
 * Send a message to the user
 */
async function sendMessage(
  chatId: string,
  text: string,
  opt: any = {
    parse_mode: "html",
  },
) {
  await bot.sendChatAction(chatId, "typing");
  return bot.sendMessage(chatId, cleanOutputText(text), opt);
}

/**
 * Send a voice message to the user
 */
async function sendVoiceMessage(chatId: string, fulfillment: Fulfillment, session: Session, botOpt: any = {}) {
  await bot.sendChatAction(chatId, "record_audio");

  if (fulfillment.audio) {
    const voiceFile = await Play.playVoiceToTempFile(fulfillment.audio);
    await bot.sendVoice(chatId, voiceFile, botOpt);
  } else {
    const sentences = mimicHumanMessage(fulfillment.fulfillmentText);
    for (const sentence of sentences) {
      const audioFile = await TTS.getAudioFile(
        sentence,
        fulfillment.payload.language || session.getTranslateTo(),
        config().tts.gender,
      );
      const voiceFile = await Play.playVoiceToTempFile(audioFile);
      await bot.sendVoice(chatId, voiceFile, botOpt);
    }
  }
}

function getIsMention(text: string) {
  return botMentionRegex.test(text);
}

function getIsActivator(text: string) {
  return getAiNameRegex().test(text);
}

function getAlias(msg: TelegramBot.Message): string {
  switch (msg.chat.type) {
    case "private":
      return `${msg.chat.first_name} ${msg.chat.last_name}`;
      break;
    default:
      return msg.chat.title;
      break;
  }
}

function getChatIsGroup(msg: TelegramBot.Message) {
  return msg.chat.type === "group";
}

async function onBotInput(e: TelegramBot.Message) {
  console.info(TAG, "input");
  console.dir(e, {
    depth: 2,
  });

  const sessionId = e.chat.id.toString();
  const chatIsGroup = getChatIsGroup(e);
  const alias = getAlias(e);
  const isMention = getIsMention(e.text);
  const isActivator = getIsActivator(e.text);
  const isReply = e.reply_to_message?.from?.id === botMe.id;

  // Register the session
  const session = await IOManager.registerSession("telegram", sessionId, e.chat, alias);

  // Process a Text object
  if (e.text) {
    // If we are in a group, only listen for activators
    if (chatIsGroup && !(isMention || isReply || isActivator)) {
      console.debug(TAG, "skipping input for missing activator");
      return false;
    }

    // Clean
    const text = cleanInputText(e);
    emitter.emit("input", {
      session,
      params: {
        text,
      },
    });
    return true;
  }

  // Process a Voice object
  if (e.voice) {
    const text = await handleInputVoice(e, session);
    const isActivatorInVoice = getIsActivator(text);

    // If we are in a group, only listen for activators
    if (chatIsGroup && !isActivatorInVoice) {
      console.debug(TAG, "skipping input for missing activator");
      return false;
    }

    // User sent a voice note, respond with a voice note :)
    session.savePipe({
      nextWithVoice: true,
    });
    emitter.emit("input", {
      session,
      params: {
        text,
      },
    });

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
          uri: photoLink,
        },
      },
    });

    return true;
  }

  emitter.emit("input", {
    session,
    error: {
      unkownInputType: true,
    },
  });
  return true;
}

/**
 * Start the polling/webhook cycle
 */
export async function start() {
  if (started) return;
  started = true;

  botMe = await bot.getMe();
  botMentionRegex = new RegExp(`@${botMe.username}`, "i");

  bot.on("message", onBotInput);
  bot.on("webhook_error", (err) => {
    console.error(TAG, "webhook error", err);
  });

  // We could attach the webhook to the Router API or via polling
  if (_config.options.polling === false) {
    bot.setWebHook(`${config().server.domain}/io/telegram/bot${_config.token}`);
    Server.routerIO.use("/telegram", bodyParser.json(), (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });
  }

  console.info(TAG, `started, botID: ${botMe.id}, botUsername: ${botMe.username}, polling: ${_config.options.polling}`);

  return true;
}

/**
 * Output an object to the user
 */
export async function output(f: Fulfillment, session: Session) {
  let processed = false;

  // Inform observers
  emitter.emit("output", {
    session,
    fulfillment: f,
  });

  // This is the Telegram Chat ID used to respond to the user
  const chatId = session.ioData.id;

  let botOpt = {};

  // If we have replies, set the bot opt to reflect the keyboard
  if (f.payload?.replies) {
    botOpt = {
      reply_markup: {
        resize_keyboard: true,
        one_time_keyboard: true,
        keyboard: [f.payload.replies],
      },
    };
  }

  // Process a Text Object
  try {
    if (f.fulfillmentText) {
      await sendMessage(chatId, f.fulfillmentText, botOpt);

      if (session.pipe.nextWithVoice) {
        session.savePipe({
          nextWithVoice: false,
        });
        await sendVoiceMessage(chatId, f, session, botOpt);
      }
      if (f.payload?.includeVoice) {
        await sendVoiceMessage(chatId, f, session, botOpt);
      }
      processed = true;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a URL Object
  try {
    if (f.payload?.url) {
      await bot.sendMessage(chatId, f.payload.url, botOpt);
      processed = true;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Video object
  try {
    if (f.payload?.video?.uri) {
      await bot.sendChatAction(chatId, "upload_video");
      await bot.sendVideo(chatId, f.payload.video.uri, botOpt);
    }
    processed = true;
  } catch (err) {
    console.error(TAG, err);
  }

  // Process an Image Object
  try {
    if (f.payload?.image?.uri) {
      await bot.sendChatAction(chatId, "upload_photo");
      await bot.sendPhoto(chatId, f.payload.image.uri, botOpt);
    }
    processed = true;
  } catch (err) {
    console.error(TAG, err);
  }

  // Process an Audio Object
  try {
    if (f.payload?.audio?.uri) {
      await bot.sendChatAction(chatId, "upload_audio");
      await bot.sendAudio(chatId, f.payload.audio.uri, botOpt);
    }
    processed = true;
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Document Object
  try {
    if (f.payload?.document?.uri) {
      await bot.sendChatAction(chatId, "upload_document");
      await bot.sendDocument(chatId, f.payload.document.uri, botOpt);
    }
    processed = true;
  } catch (err) {
    console.error(TAG, err);
  }

  try {
    if (f.payload?.error?.message) {
      await sendMessage(chatId, f.payload.error.message, botOpt);
      processed = true;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // ---- Telegram specific Objects ----

  // Process a Game Object
  try {
    if (f.payload?.telegram?.game) {
      callbackQuery[chatId] = callbackQuery[chatId] || {};
      callbackQuery[chatId][f.payload.telegram.game] = f.payload.telegram.game;
      await bot.sendGame(chatId, f.payload.telegram.game);
      processed = true;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  // Process a Sticker Object
  try {
    if (f.payload?.telegram?.sticker) {
      await bot.sendSticker(chatId, f.payload.telegram.sticker, botOpt);
      processed = true;
    }
  } catch (err) {
    console.error(TAG, err);
  }

  return processed;
}
