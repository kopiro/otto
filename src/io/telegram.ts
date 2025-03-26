import TelegramBot from "node-telegram-bot-api";
import { EventEmitter } from "events";
import config from "../config";
import * as Server from "../stdlib/server";
import { IODriverRuntime, IODriverMultiOutput, IODriverEventMap, IODriverId, IOBag } from "../stdlib/io-manager";
import { getVoiceFileFromText } from "../stdlib/voice-helpers";
import * as Proc from "../stdlib/proc";
import { Authorization, Output, Language, Input } from "../types";
import bodyParser from "body-parser";
import { SpeechRecognizer } from "../stdlib/speech-recognizer";
import { Signale } from "signale";
import { getAINameRegexp } from "../helpers";
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
  messageId?: number;
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
    this.emitter.on("thinking", this.thinking.bind(this));
  }

  /**
   * Handle a voice input by recognizing the text
   */
  private async handleVoiceInput(fileId: string, language: Language): Promise<string> {
    const fileLink = await this.bot.getFileLink(fileId);
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

  private cleanText(text: string) {
    return text.replace(`@${this.botMe!.username}`, "");
  }

  private cleanOutputText(text: string) {
    return text;
  }

  /**
   * Send a message to the user
   */
  private async sendMessage(chatId: number, text: string, botOpt: TelegramBot.SendMessageOptions = {}) {
    return this.bot.sendMessage(chatId, this.cleanOutputText(text), {
      ...(botOpt || {}),
      parse_mode: "HTML",
    });
  }

  /**
   * Send a voice message to the user
   */
  async sendAudioNoteFromText(
    chatId: number,
    text: string,
    fallbackLanguage: Language,
    botOpt: TelegramBot.SendMessageOptions = {},
  ) {
    const voiceFile = await getVoiceFileFromText(text, fallbackLanguage);
    return this.bot.sendVoice(chatId, voiceFile.getAbsolutePath(), botOpt);
  }

  private isMention(text: string) {
    return this.botMentionRegex?.test(text) || getAINameRegexp().test(text);
  }

  private isGroup(msg: TelegramBot.Message) {
    return msg.chat.type === "group" || msg.chat.type === "supergroup";
  }

  private isReplyToText(msg: TelegramBot.Message) {
    const isReply = msg.reply_to_message?.from?.id === this.botMe?.id;
    return isReply ? msg.reply_to_message?.text : false;
  }

  private getIOData(msg: TelegramBot.Message): IODataTelegram {
    return msg.chat;
  }

  private getIOChannelIdentifier(msg: TelegramBot.Message) {
    return String(msg.chat.id);
  }

  private getPersonIdentifier(from: TelegramBot.User) {
    return String(from.id);
  }

  private getPersonName(from: TelegramBot.User): string {
    const { first_name, last_name, username, id } = from;
    if (first_name && last_name) {
      return `${first_name} ${last_name[0]}.`;
    }
    if (first_name) {
      return first_name;
    }
    if (username) {
      return username;
    }
    return String(id);
  }

  private emitInput(e: TelegramBot.Message, input: Input, ioChannel: TIOChannel, person: TPerson, bag: IOBag) {
    // @ts-ignore
    this.bot.setMessageReaction(e.chat.id, e.message_id, {
      reaction: JSON.stringify([{ type: "emoji", emoji: "👀️" }]),
    });
    this.emitter.emit("input", input, ioChannel, person, bag);
  }

  async onBotInput(e: TelegramBot.Message) {
    if (!e.from) {
      logger.error("Invalid {from}", e);
      return;
    }

    const personIdentifier = this.getPersonIdentifier(e.from);
    const personName = this.getPersonName(e.from);
    const person = await Person.findByIOIdentifierOrCreate(
      this.driverId,
      personIdentifier,
      personName,
      e.from.language_code as Language,
    );

    const ioChannelIdentifier = this.getIOChannelIdentifier(e);
    const ioChannel = await IOChannel.findByIOIdentifierOrCreate(
      this.driverId,
      ioChannelIdentifier,
      this.getIOData(e),
      person,
      e.chat.type === "private",
    );

    const bag: IOBagTelegram = {
      messageId: e.message_id,
    };

    const isGroup = this.isGroup(e);
    const replyToText = this.isReplyToText(e);

    // Process a Text object
    if (e.text) {
      const text = this.cleanText(e.text || "");
      const isMention = this.isMention(text);

      // If we are in a group, only listen for activators
      if (isGroup && !(isMention || replyToText)) {
        logger.debug("Received message, but skipping it because no mention of the AI name was found");
        return false;
      }

      const input: Input = { text };
      if (replyToText) {
        input.replyToText = replyToText;
      }

      this.emitInput(e, input, ioChannel, person, bag);

      return true;
    }

    // Process a Voice object
    if (e.voice) {
      const text = await this.handleVoiceInput(e.voice.file_id, person.getLanguage());
      const isMention = this.isMention(text);

      // If we are in a group, only listen for activators
      if (isGroup && !(isMention || replyToText)) {
        logger.debug("Received vocal in a group, but skipping it because no mention of the AI name was found");
        return false;
      }

      const input: Input = { text };
      if (replyToText) {
        input.replyToText = replyToText;
      }

      // User sent a voice note, respond with a voice note :)
      this.emitInput(e, input, ioChannel, person, { ...bag, respondWithAudioNote: true });

      return true;
    }

    // Process a Photo Object
    if (e.photo) {
      // const image = await this.bot.getFileLink(e.photo[e.photo.length - 1].file_id);
      if (isGroup) return false;
      return false;
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

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.botMentionRegex = new RegExp(this.botMe.username!);

    this.bot.on("message", this.onBotInput.bind(this));

    this.bot.on("webhook_error", (err) => {
      logger.error("Webhook Error", err);
    });

    // We could attach the webhook to the Router API or via polling
    if (this.conf.options.polling === false) {
      this.bot.setWebHook(`${Server.getDomain()}/io/telegram/bot${this.conf.token}`);

      Server.routerIO.use("/telegram", bodyParser.json(), (req, res) => {
        this.bot.processUpdate(req.body);
        res.sendStatus(200);
      });
    }

    logger.success(
      `Started, botID: ${this.botMe.id}, botUsername: ${this.botMe.username}, polling: ${this.conf.options.polling}`,
    );
  }

  async thinking(ioChannel: TIOChannel) {
    const ioData = ioChannel.ioData as IODataTelegram;
    const chatId = ioData.id;

    this.bot.sendChatAction(chatId, "typing");
  }

  /**
   * Output an object to the user
   */
  async output(output: Output, ioChannel: TIOChannel, person: TPerson, _bag: IOBag): Promise<IODriverMultiOutput> {
    const results: IODriverMultiOutput = [];

    const bag = _bag as IOBagTelegram;
    const ioData = ioChannel.ioData as IODataTelegram;

    const chatId = ioData.id;
    const { messageId } = bag || {};

    const botOpt: TelegramBot.SendMessageOptions = {};

    if (messageId) {
      botOpt.reply_to_message_id = messageId;
    }

    if (output.reaction) {
      try {
        if (messageId) {
          // @ts-ignore
          this.bot.setMessageReaction(chatId, messageId, {
            reaction: JSON.stringify([{ type: "emoji", emoji: output.reaction.trim() }]),
          });
        }
      } catch (err) {
        logger.error(err);
        results.push(["error", err]);
      }
    }

    // Process a Text Object
    try {
      if (output.text) {
        const r = await this.sendMessage(chatId, output.text, botOpt);
        results.push(["message", r]);

        if (bag?.respondWithAudioNote || ioChannel.options?.respondWithAudioNote) {
          this.bot.sendChatAction(chatId, "record_voice");
          const r = await this.sendAudioNoteFromText(chatId, output.text, person.getLanguage(), botOpt);
          results.push(["audionote", r]);
        }
      }
    } catch (err) {
      logger.error(err);
      results.push(["error", err]);
    }

    // Process a Video object
    try {
      if (output.video) {
        this.bot.sendChatAction(chatId, "upload_video");
        const r = await this.bot.sendVideo(chatId, output.video, botOpt);
        results.push(["video", r]);
      }
    } catch (err) {
      logger.error(err);
      results.push(["error", err]);
    }

    // Process an Image Object
    try {
      if (output.image) {
        this.bot.sendChatAction(chatId, "upload_photo");
        const r = await this.bot.sendPhoto(chatId, output.image, {
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
      if (output.voice) {
        this.bot.sendChatAction(chatId, "record_voice");
        const r = await this.bot.sendVoice(chatId, output.voice, botOpt);
        results.push(["voice", r]);
      }
    } catch (err) {
      logger.error(err);
      results.push(["error", err]);
    }

    // Process an Audio Object
    try {
      if (output.audio) {
        this.bot.sendChatAction(chatId, "upload_voice");
        const r = await this.bot.sendAudio(chatId, output.audio, botOpt);
        results.push(["audio", r]);
      }
    } catch (err) {
      logger.error(err);
      results.push(["error", err]);
    }

    // Process a Document Object
    try {
      if (output.document) {
        this.bot.sendChatAction(chatId, "upload_document");
        const r = await this.bot.sendDocument(chatId, output.document, botOpt);
        results.push(["document", r]);
      }
    } catch (err) {
      logger.error(err);
      results.push(["error", err]);
    }

    try {
      if (output.error) {
        const errorMessage = output.error?.message || "Sorry, an error occurred; please try again later.";
        const r = await this.sendMessage(chatId, errorMessage, botOpt);

        if (person.authorizations?.includes(Authorization.ADMIN)) {
          this.sendMessage(chatId, `<pre>${JSON.stringify(output.error)}</pre>`, botOpt);
        }

        results.push(["message", r]);
      }
    } catch (err) {
      logger.error(err);
      results.push(["error", err]);
    }

    try {
      if (output.data) {
        const r = await this.sendMessage(chatId, `<pre>${output.data}</pre>`, botOpt);
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
