import fs from "fs";
import path from "path";
import request from "request";
import TelegramBot from "node-telegram-bot-api";
import Events from "events";
import config from "../config";
import * as Server from "../stdlib/server";
import * as IOManager from "../stdlib/iomanager";
import voice from "../stdlib/voice";
import * as Proc from "../lib/proc";
import { v4 as uuid } from "uuid";
import { tmpDir } from "../paths";
import { Fulfillment, Session as ISession } from "../types";
import bodyParser from "body-parser";
import { File } from "../stdlib/file";
import textToSpeech from "../stdlib/text-to-speech";
import speechRecognizer from "../stdlib/speech-recognizer";
import { Signale } from "signale";
import { getSessionTranslateFrom, getSessionTranslateTo } from "../helpers";
import AICommander from "../stdlib/ai/commander";

const TAG = "IO.Telegram";
const console = new Signale({
  scope: TAG,
});
const DRIVER_ID = "telegram";

export type TelegramConfig = {
  token: string;
  options: TelegramBot.ConstructorOptions;
};

export type TelegramBag = {
  encodable: {
    replyToMessageId?: number;
    respondWithAudioNote?: boolean;
  };
};

export class Telegram implements IOManager.IODriverModule {
  config: TelegramConfig;

  emitter: Events.EventEmitter = new Events.EventEmitter();

  bot: TelegramBot;
  botMe: TelegramBot.User;
  botMentionRegex: RegExp;

  started = false;

  constructor(config: TelegramConfig) {
    this.config = config;
    this.bot = new TelegramBot(this.config.token, this.config.options);
  }

  /**
   * Handle a voice input by recognizing the text
   */
  async handleInputVoice(e: TelegramBot.Message, session: ISession): Promise<string> {
    return new Promise((resolve) => {
      (async () => {
        const fileLink = await this.bot.getFileLink(e.voice.file_id);
        const voiceFile = path.join(tmpDir, `${uuid()}.ogg`);
        const voiceWavFile = `${voiceFile}.wav`;

        request(fileLink)
          .pipe(fs.createWriteStream(voiceFile))
          .on("close", async () => {
            await Proc.spawn("opusdec", [voiceFile, voiceWavFile, "--rate", speechRecognizer().SAMPLE_RATE]).result;
            const text = await speechRecognizer().recognizeFile(voiceWavFile, getSessionTranslateFrom(session));
            resolve(text);
          });
      })();
    });
  }

  /**
   * Remove any XML tag
   */
  cleanOutputText(text: string) {
    return text.replace(/<[^>]+>/g, "");
  }

  cleanInputText(e: TelegramBot.Message) {
    let text = e.text;
    text = text.replace(`@${this.botMe.username}`, "");
    return text;
  }

  /**
   * Send a message to the user
   */
  async sendMessage(chatId: string, text: string, opt: any = {}) {
    return this.bot.sendMessage(chatId, this.cleanOutputText(text), { ...{ parse_mode: "HTML" }, ...opt });
  }

  async getVoiceFile(fulfillment: Fulfillment, session: ISession): Promise<File> {
    const audioFile = await textToSpeech().getAudioFile(
      fulfillment.text,
      fulfillment.options.language || getSessionTranslateTo(session),
      config().tts.gender,
    );
    return voice().getFile(audioFile);
  }

  /**
   * Send a voice message to the user
   */
  async sendAudioNote(
    chatId: string,
    fulfillment: Fulfillment,
    session: ISession,
    botOpt: TelegramBot.SendMessageOptions = {},
  ) {
    await this.bot.sendChatAction(chatId, "record_voice");
    const voiceFile = await this.getVoiceFile(fulfillment, session);
    return this.bot.sendVoice(chatId, voiceFile.getAbsolutePath(), botOpt);
  }

  getIsMention(text: string) {
    return this.botMentionRegex.test(text);
  }

  getIsActivator(text: string | undefined) {
    return text?.includes(config().aiName);
  }

  getIsGroup(msg: TelegramBot.Message) {
    return msg.chat.type === "group" || msg.chat.type === "supergroup";
  }

  getIsCommand(msg: TelegramBot.Message) {
    return msg.text?.startsWith("/");
  }

  private async parseMessage(e: TelegramBot.Message) {
    const sessionId = `u${e.from.id}c${e.chat.id}`;

    const session = await IOManager.registerSession(DRIVER_ID, sessionId, { from: e.from, chat: e.chat });

    const bag: TelegramBag = {
      encodable: {
        replyToMessageId: e.message_id,
      },
    };

    const isGroup = this.getIsGroup(e);
    const isMention = this.getIsMention(e.text);
    const isActivator = this.getIsActivator(e.text);
    const isReply = e.reply_to_message?.from?.id === this.botMe.id;
    const isCommand = this.getIsCommand(e);

    return { session, bag, isGroup, isMention, isActivator, isReply, isCommand };
  }

  async onBotInput(e: TelegramBot.Message) {
    console.info("input", e);

    // Register the session
    const { session, bag, isGroup, isMention, isReply, isActivator, isCommand } = await this.parseMessage(e);

    console.info(`session = ${session.id}`);

    // Process a command
    if (isCommand) {
      this.emitter.emit("input", {
        session,
        params: {
          command: e.text,
          bag,
        },
      });
      return true;
    }

    // Process a Text object
    if (e.text) {
      // If we are in a group, only listen for activators
      if (isGroup && !(isMention || isReply || isActivator)) {
        console.debug("skipping input for missing activator");
        return false;
      }

      // Clean
      const text = this.cleanInputText(e);

      this.bot.sendChatAction(e.chat.id, "typing");

      this.emitter.emit("input", {
        session,
        params: {
          text,
          bag,
        },
      });

      return true;
    }

    // Process a Voice object
    if (e.voice) {
      const text = await this.handleInputVoice(e, session);
      const isActivatorInVoice = this.getIsActivator(text);

      // If we are in a group, only listen for activators
      if (isGroup && !isActivatorInVoice) {
        console.debug("skipping input for missing activator");
        return false;
      }

      this.bot.sendChatAction(e.chat.id, "record_voice");

      // User sent a voice note, respond with a voice note :)
      this.emitter.emit("input", {
        session,
        params: {
          text,
          bag: { ...bag, encodable: { ...bag.encodable, respondWithAudioNote: true } },
        },
      });

      return true;
    }

    // Process a Photo Object
    if (e.photo) {
      const photoLink = this.bot.getFileLink(e.photo[e.photo.length - 1].file_id);
      if (isGroup) return false;

      this.bot.sendChatAction(e.chat.id, "typing");

      this.emitter.emit("input", {
        session,
        params: {
          bag,
          image: {
            uri: photoLink,
          },
        },
      });

      return true;
    }

    return false;
  }

  /**
   * Start the polling/webhook cycle
   */
  async start() {
    if (this.started) return;
    this.started = true;

    this.botMe = await this.bot.getMe();
    this.botMentionRegex = new RegExp(`@${this.botMe.username}`, "i");

    this.bot.on("message", this.onBotInput.bind(this));
    this.bot.on("poll_answer", this.onBotInput.bind(this));

    this.bot.on("webhook_error", (err) => {
      console.error("webhook error", err);
    });

    // Add list of commands
    this.bot.setMyCommands(AICommander().commandMapping.map((c) => ({ command: c.name, description: c.description })));

    // We could attach the webhook to the Router API or via polling
    if (this.config.options.polling === false) {
      this.bot.setWebHook(`${Server.getDomain()}/io/telegram/bot${this.config.token}`);
      Server.routerIO.use("/telegram", bodyParser.json(), (req, res) => {
        this.bot.processUpdate(req.body);
        res.sendStatus(200);
      });
    }

    console.info(
      TAG,
      `started, botID: ${this.botMe.id}, botUsername: ${this.botMe.username}, polling: ${this.config.options.polling}`,
    );

    return true;
  }

  /**
   * Output an object to the user
   */
  async output(f: Fulfillment, session: ISession, bag: TelegramBag) {
    const results = [];

    // Inform observers
    this.emitter.emit("output", {
      session,
      fulfillment: f,
    });

    // This is the Telegram Chat ID used to respond to the user
    const chatId = session.ioData.chat.id;
    const botOpt: TelegramBot.SendMessageOptions = {};

    if (bag?.encodable?.replyToMessageId) {
      botOpt.reply_to_message_id = bag.encodable.replyToMessageId;
    }

    // Process a Text Object
    try {
      if (f.text) {
        const r = await this.sendMessage(chatId, f.text, botOpt);
        results.push(["message", r]);

        if (bag?.encodable?.respondWithAudioNote || f.options?.includeVoice) {
          const r = await this.sendAudioNote(chatId, f, session, botOpt);
          results.push(["audionote", r]);
        }
      }
    } catch (err) {
      console.error(err);
      results.push(["error", err]);
    }

    // Process a Video object
    try {
      if (f.video) {
        this.bot.sendChatAction(chatId, "upload_video");
        const r = await this.bot.sendVideo(chatId, f.video, botOpt);
        results.push(["video", r]);
      }
    } catch (err) {
      console.error(err);
      results.push(["error", err]);
    }

    // Process an Image Object
    try {
      if (f.image) {
        this.bot.sendChatAction(chatId, "upload_photo");
        const r = await this.bot.sendPhoto(chatId, f.image, {
          ...botOpt,
          caption: f.caption,
        });
        results.push(["photo", r]);
      }
    } catch (err) {
      console.error(err);
      results.push(["error", err]);
    }

    // Process an Audio Object
    try {
      if (f.audio) {
        this.bot.sendChatAction(chatId, "upload_voice");
        const r = await this.bot.sendAudio(chatId, f.audio, botOpt);
        results.push(["audio", r]);
      }
    } catch (err) {
      results.push(["error", err]);
      console.error(err);
    }

    // Process a Document Object
    try {
      if (f.document) {
        this.bot.sendChatAction(chatId, "upload_document");
        const r = await this.bot.sendDocument(chatId, f.document, botOpt);
        results.push(["document", r]);
      }
    } catch (err) {
      console.error(err);
      results.push(["error", err]);
    }

    try {
      if (f.error) {
        const r = await this.sendMessage(chatId, `<pre>${JSON.stringify(f.error, null, 2)}</pre>`, botOpt);
        results.push(["message", r]);
      }
    } catch (err) {
      console.error(err);
      results.push(["error", err]);
    }

    try {
      if (f.data) {
        const r = await this.sendMessage(chatId, `<pre>${f.data}</pre>`, botOpt);
        results.push(["data", r]);
      }
    } catch (err) {
      console.error(err);
      results.push(["error", err]);
    }

    return results;
  }
}

let _instance: Telegram;
export default (): Telegram => {
  _instance = _instance || new Telegram(config().telegram);
  return _instance;
};
