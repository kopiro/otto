import TelegramBot from "node-telegram-bot-api";
import Events from "events";
import config from "../config";
import * as Server from "../stdlib/server";
import { IODriverRuntime, IODriverOutput } from "../stdlib/iomanager";
import { getVoiceFileFromFulfillment } from "../stdlib/voice";
import * as Proc from "../stdlib/proc";
import { Fulfillment } from "../types";
import bodyParser from "body-parser";
import { SpeechRecognizer } from "../stdlib/speech-recognizer";
import { Signale } from "signale";
import { getAINameRegexp } from "../helpers";
import { AICommander } from "../stdlib/ai/ai-commander";
import { Session, TSession } from "../data/session";
import fetch from "node-fetch";
import { writeFile } from "fs/promises";
import { File } from "../stdlib/file";

const TAG = "IO.Telegram";
const logger = new Signale({
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

export type IODataTelegram = {
  from: TelegramBot.User;
  chat: TelegramBot.Chat;
};

export class Telegram implements IODriverRuntime {
  emitter: Events.EventEmitter = new Events.EventEmitter();

  bot: TelegramBot;
  botMe?: TelegramBot.User;
  botMentionRegex?: RegExp;

  started = false;

  constructor(private conf: TelegramConfig) {
    this.bot = new TelegramBot(this.conf.token, this.conf.options);
  }

  /**
   * Handle a voice input by recognizing the text
   */
  private async handleVoiceInput(e: TelegramBot.Message, session: TSession): Promise<string> {
    const fileLink = await this.bot.getFileLink(e.voice.file_id);
    const oggFile = File.getTmpFile("ogg");
    const wavFile = File.getTmpFile("wav");

    const response = await fetch(fileLink);
    const buffer = await response.buffer();
    await writeFile(oggFile.getAbsolutePath(), buffer);

    await Proc.processSpawn("opusdec", [
      oggFile.getAbsolutePath(),
      wavFile.getAbsolutePath(),
      "--rate",
      SpeechRecognizer.getInstance().SAMPLE_RATE,
    ]).result;

    const text = await SpeechRecognizer.getInstance().recognizeFile(wavFile.getAbsolutePath(), session.getLanguage());

    return text;
  }

  /**
   * Remove any XML tag
   */
  private cleanOutputText(text: string) {
    return text.replace(/<[^>]+>/g, "");
  }

  private cleanInputText(e: TelegramBot.Message) {
    let text = e.text || "";
    text = text.replace(`@${this.botMe.username}`, "");
    return text;
  }

  /**
   * Send a message to the user
   */
  private async sendMessage(chatId: string, text: string, botOpt: TelegramBot.SendMessageOptions = {}) {
    return this.bot.sendMessage(chatId, this.cleanOutputText(text), { ...{ parse_mode: "HTML" }, ...botOpt });
  }

  /**
   * Send a voice message to the user
   */
  async sendAudioNoteFromText(
    chatId: string,
    fulfillment: Fulfillment,
    session: TSession,
    botOpt: TelegramBot.SendMessageOptions = {},
  ) {
    const voiceFile = await getVoiceFileFromFulfillment(fulfillment, session);
    return this.bot.sendVoice(chatId, voiceFile.getAbsolutePath(), botOpt);
  }

  private getIsMention(text: string) {
    return this.botMentionRegex?.test(text) || getAINameRegexp().test(text);
  }

  private getIsGroup(msg: TelegramBot.Message) {
    return msg.chat.type === "group" || msg.chat.type === "supergroup";
  }

  private getIsCommand(msg: TelegramBot.Message) {
    return msg.text?.startsWith("/");
  }

  private getIsReply(msg: TelegramBot.Message) {
    return msg.reply_to_message?.from?.id === this.botMe?.id;
  }

  private getIOData(msg: TelegramBot.Message): IODataTelegram {
    return { from: msg.from, chat: msg.chat };
  }

  private getSessionIdentifier(msg: TelegramBot.Message) {
    return `u${msg.from?.id || "unknown"}c${msg.chat.id}`;
  }

  private async parseMessage(e: TelegramBot.Message) {
    const sessionIdentifier = this.getSessionIdentifier(e);
    const ioData = this.getIOData(e);

    const session = await Session.findByIOIdentifierOrCreate(DRIVER_ID, sessionIdentifier, ioData);

    const bag: TelegramBag = {
      encodable: {
        replyToMessageId: e.message_id,
      },
    };

    const isGroup = this.getIsGroup(e);
    const isMention = this.getIsMention(e.text || "");
    const isReply = this.getIsReply(e);
    const isCommand = this.getIsCommand(e);

    return { session, bag, isGroup, isMention, isReply, isCommand };
  }

  async onBotInput(e: TelegramBot.Message) {
    const parsedMessage = await this.parseMessage(e);
    const { session, bag, isGroup, isMention, isReply, isCommand } = parsedMessage;

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
      if (isGroup && !(isMention || isReply)) {
        logger.debug("Skipping input for missing activator", e);
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
      const text = await this.handleVoiceInput(e, session);
      const isMentionInVoice = this.getIsMention(text);

      // If we are in a group, only listen for activators
      if (isGroup && !isMentionInVoice) {
        logger.debug("Skipping input for missing activator");
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

    this.bot.on("webhook_error", (err) => {
      logger.error("Webhook Error", err);
    });

    // Add list of commands
    this.bot.setMyCommands(
      AICommander.getInstance().commandMapping.map((c) => ({ command: c.name, description: c.description })),
    );

    // We could attach the webhook to the Router API or via polling
    if (this.conf.options.polling === false) {
      this.bot.setWebHook(`${Server.getDomain()}/io/telegram/bot${this.conf.token}`);

      Server.routerIO.use("/telegram", bodyParser.json(), (req, res) => {
        this.bot.processUpdate(req.body);
        res.sendStatus(200);
      });
    }

    logger.info(
      TAG,
      `started, botID: ${this.botMe.id}, botUsername: ${this.botMe.username}, polling: ${this.conf.options.polling}`,
    );
  }

  /**
   * Output an object to the user
   */
  async output(f: Fulfillment, session: TSession, bag: TelegramBag): Promise<IODriverOutput> {
    const results: IODriverOutput = [];

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
        this.bot.sendChatAction(chatId, "typing");
        const r = await this.sendMessage(chatId, f.text, botOpt);
        results.push(["message", r]);

        if (bag?.encodable?.respondWithAudioNote || f.options?.includeVoice) {
          this.bot.sendChatAction(chatId, "record_voice");
          const r = await this.sendAudioNoteFromText(chatId, f, session, botOpt);
          results.push(["audionote", r]);
        }
      }
    } catch (err) {
      logger.error(err);
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
      logger.error(err);
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
      logger.error(err);
      results.push(["error", err]);
    }

    // Process a Voice Object
    try {
      if (f.voice) {
        this.bot.sendChatAction(chatId, "record_voice");
        const r = await this.bot.sendVoice(chatId, f.voice, botOpt);
        results.push(["voice", r]);
      }
    } catch (err) {
      results.push(["error", err]);
      logger.error(err);
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
      logger.error(err);
    }

    // Process a Document Object
    try {
      if (f.document) {
        this.bot.sendChatAction(chatId, "upload_document");
        const r = await this.bot.sendDocument(chatId, f.document, botOpt);
        results.push(["document", r]);
      }
    } catch (err) {
      logger.error(err);
      results.push(["error", err]);
    }

    try {
      if (f.error) {
        this.bot.sendChatAction(chatId, "typing");
        const r = await this.sendMessage(chatId, f.error.message || "Unknown error", botOpt);
        results.push(["message", r]);
      }
    } catch (err) {
      logger.error(err);
      results.push(["error", err]);
    }

    try {
      if (f.data) {
        this.bot.sendChatAction(chatId, "typing");
        const r = await this.sendMessage(chatId, `<pre>${f.data}</pre>`, botOpt);
        results.push(["data", r]);
      }
    } catch (err) {
      logger.error(err);
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
