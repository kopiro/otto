import TelegramBot from "node-telegram-bot-api";
import { EventEmitter } from "events";
import config from "../config";
import * as Server from "../stdlib/server";
import { IODriverRuntime, IODriverOutput, IODriverEventMap, IODriverId } from "../stdlib/io-manager";
import { getVoiceFileFromFulfillment } from "../stdlib/voice-helpers";
import * as Proc from "../stdlib/proc";
import { Fulfillment, Language } from "../types";
import bodyParser from "body-parser";
import { SpeechRecognizer } from "../stdlib/speech-recognizer";
import { Signale } from "signale";
import { getAINameRegexp } from "../helpers";
import { AICommander } from "../stdlib/ai/ai-commander";
import { IOChannel, TIOChannel } from "../data/io-channel";
import fetch from "node-fetch";
import { writeFile } from "fs/promises";
import { File } from "../stdlib/file";
import { Person, TPerson } from "../data/person";
import TypedEmitter from "typed-emitter";

const TAG = "IO.Telegram";
const logger = new Signale({
  scope: TAG,
});

export type TelegramConfig = {
  token: string;
  options: TelegramBot.ConstructorOptions;
};

export type IOBagTelegram = {
  replyToMessageId?: number;
  respondWithAudioNote?: boolean;
};

export type IODataTelegram = TelegramBot.Chat;

export class Telegram implements IODriverRuntime {
  driverId: IODriverId = "telegram";

  emitter = new EventEmitter() as TypedEmitter<IODriverEventMap>;

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
  private async handleVoiceInput(e: TelegramBot.Message, language: Language): Promise<string> {
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

    const text = await SpeechRecognizer.getInstance().recognizeFile(wavFile.getAbsolutePath(), language);

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
  private async sendMessage(chatId: number, text: string, botOpt: TelegramBot.SendMessageOptions = {}) {
    return this.bot.sendMessage(chatId, this.cleanOutputText(text), { ...{ parse_mode: "HTML" }, ...botOpt });
  }

  /**
   * Send a voice message to the user
   */
  async sendAudioNoteFromText(
    chatId: number,
    fulfillment: Fulfillment,
    language: Language,
    botOpt: TelegramBot.SendMessageOptions = {},
  ) {
    const voiceFile = await getVoiceFileFromFulfillment(fulfillment, language);
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
    return msg.chat;
  }

  private getIOChannelIdentifier(msg: TelegramBot.Message) {
    return String(msg.chat.id);
  }

  private getPersonIdentifier(msg: TelegramBot.Message) {
    return String(msg.from.id);
  }

  private getPersonName(msg: TelegramBot.Message): string {
    const { first_name, last_name, username, id } = msg.from;
    if (first_name && last_name) {
      return `${first_name} ${last_name}`;
    }
    if (first_name) {
      return first_name;
    }
    if (username) {
      return username;
    }
    return String(id);
  }

  async onBotInput(e: TelegramBot.Message) {
    const personIdentifier = this.getPersonIdentifier(e);
    const person = await Person.findByIOIdentifierOrCreate(
      this.driverId,
      personIdentifier,
      this.getPersonName(e),
      e.from.language_code,
    );

    const ioChannelIdentifier = this.getIOChannelIdentifier(e);
    const ioChannel = await IOChannel.findByIOIdentifierOrCreate(
      this.driverId,
      ioChannelIdentifier,
      this.getIOData(e),
      // Only in the case of direct message we can link this ioChannel directly to a person
      e.chat.type === "private" ? person : null,
    );

    const bag: IOBagTelegram = {
      replyToMessageId: e.message_id,
    };

    const isGroup = this.getIsGroup(e);
    const isMention = this.getIsMention(e.text || "");
    const isReply = this.getIsReply(e);
    const isCommand = this.getIsCommand(e);

    // Process a command
    if (isCommand) {
      this.emitter.emit(
        "input",
        {
          command: e.text,
        },
        ioChannel,
        person,
        bag,
      );
      return true;
    }

    // Process a Text object
    if (e.text) {
      // If we are in a group, only listen for activators
      if (isGroup && !(isMention || isReply)) {
        logger.debug("Received message, but skipping it");
        return false;
      }

      // Clean
      const text = this.cleanInputText(e);

      this.bot.sendChatAction(e.chat.id, "typing");

      this.emitter.emit(
        "input",
        {
          text,
        },
        ioChannel,
        person,
        bag,
      );

      return true;
    }

    // Process a Voice object
    if (e.voice) {
      const text = await this.handleVoiceInput(e, person.language);
      const isMentionInVoice = this.getIsMention(text);

      // If we are in a group, only listen for activators
      if (isGroup && !isMentionInVoice) {
        logger.debug("Received vocal, but skipping it");
        return false;
      }

      this.bot.sendChatAction(e.chat.id, "record_voice");

      // User sent a voice note, respond with a voice note :)
      this.emitter.emit(
        "input",
        {
          text,
        },
        ioChannel,
        person,
        { ...bag, respondWithAudioNote: true },
      );

      return true;
    }

    // Process a Photo Object
    if (e.photo) {
      const image = await this.bot.getFileLink(e.photo[e.photo.length - 1].file_id);
      if (isGroup) return false;

      this.bot.sendChatAction(e.chat.id, "typing");

      this.emitter.emit(
        "input",
        {
          image,
        },
        ioChannel,
        person,
        bag,
      );

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
      `Started, botID: ${this.botMe.id}, botUsername: ${this.botMe.username}, polling: ${this.conf.options.polling}`,
    );
  }

  /**
   * Output an object to the user
   */
  async output(
    f: Fulfillment,
    ioChannel: TIOChannel,
    person: TPerson | null,
    bag: IOBagTelegram,
  ): Promise<IODriverOutput> {
    const results: IODriverOutput = [];

    const ioData = ioChannel.ioData as IODataTelegram;
    const chatId = ioData.id;
    const botOpt: TelegramBot.SendMessageOptions = {};

    if (bag?.replyToMessageId) {
      botOpt.reply_to_message_id = bag.replyToMessageId;
    }

    // Process a Text Object
    try {
      if (f.text) {
        this.bot.sendChatAction(chatId, "typing");
        const r = await this.sendMessage(chatId, f.text, botOpt);
        results.push(["message", r]);

        if (bag?.respondWithAudioNote || f.options?.includeVoice) {
          this.bot.sendChatAction(chatId, "record_voice");
          const r = await this.sendAudioNoteFromText(chatId, f, person.language, botOpt);
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
      logger.error(err);
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
      logger.error(err);
      results.push(["error", err]);
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
