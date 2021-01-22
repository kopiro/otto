import fs from "fs";
import path from "path";
import request from "request";
import TelegramBot from "node-telegram-bot-api";
import Events from "events";
import config from "../config";
import * as Server from "../stdlib/server";
import * as IOManager from "../stdlib/iomanager";
import SpeechRecognizer from "../stdlib/speech-recognizer";
import TextToSpeech from "../stdlib/text-to-speech";
import Voice from "../stdlib/voice";
import * as Proc from "../lib/proc";
import { v4 as uuid } from "uuid";
import { tmpDir } from "../paths";
import { Fulfillment, Session as ISession } from "../types";
import { getAiNameRegex, getTmpFile } from "../helpers";
import bodyParser from "body-parser";
import { File } from "../stdlib/file";
import { Session } from "../data";
import childProcess from "child_process";

const TAG = "IO.Telegram";
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

type CommandFunction = (args: RegExpMatchArray, session: ISession, bag: TelegramBag) => Promise<Fulfillment>;

class Telegram implements IOManager.IODriverModule {
  config: TelegramConfig;

  emitter: Events.EventEmitter = new Events.EventEmitter();

  bot: TelegramBot;
  botMe: TelegramBot.User;
  botMentionRegex: RegExp;

  started = false;

  commandMapping: [RegExp, CommandFunction][] = [
    [/^\/out ([^\s]+) (.+)/, this.commandOut],
    [/^\/findsess (.+)/, this.commandFindSessionByName],
    [/^\/appstop/, this.commandAppStop],
    [/^\/.+/, this.commandNotFound],
  ];

  constructor(config: TelegramConfig) {
    this.config = config;
    this.bot = new TelegramBot(this.config.token, this.config.options);
  }

  /**
   * Handle a voice input by recognizing the text
   */
  async handleInputVoice(e: TelegramBot.Message, session: ISession): Promise<string> {
    return new Promise(async (resolve) => {
      const fileLink = await this.bot.getFileLink(e.voice.file_id);
      const voiceFile = path.join(tmpDir, `${uuid()}.ogg`);
      const voiceWavFile = `${voiceFile}.wav`;

      request(fileLink)
        .pipe(fs.createWriteStream(voiceFile))
        .on("close", async () => {
          await Proc.spawn("opusdec", [voiceFile, voiceWavFile, "--rate", SpeechRecognizer.SAMPLE_RATE]);
          const text = await SpeechRecognizer.recognizeFile(voiceWavFile, session.getTranslateFrom());
          resolve(text);
        });
    });
  }

  /**
   * Remove any XML tag
   */
  cleanOutputText(text: string) {
    return text.replace(/<[^>]+>/g, "");
  }

  /**
   * Split a text using a pattern to mimic a message sent by a human
   */
  mimicHumanMessage(text: string): Array<string> {
    return this.cleanOutputText(text)
      .split(/\\n|\n|\.(?=\s+|[A-Z])/)
      .filter((e) => e.length > 0);
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
    await this.bot.sendChatAction(chatId, "typing");
    return this.bot.sendMessage(chatId, this.cleanOutputText(text), { ...{ parse_mode: "HTML" }, ...opt });
  }

  async getVoiceFile(fulfillment: Fulfillment, session: ISession): Promise<File> {
    if (fulfillment.audio) {
      return Voice.getFile(fulfillment.audio);
    } else {
      const audioFile = await TextToSpeech.getAudioFile(
        fulfillment.fulfillmentText,
        fulfillment.payload.language || session.getTranslateTo(),
        config().tts.gender,
      );
      return Voice.getFile(audioFile);
    }
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
    await this.bot.sendChatAction(chatId, "record_audio");
    const voiceFile = await this.getVoiceFile(fulfillment, session);
    return this.bot.sendVoice(chatId, voiceFile.getAbsoluteFSPath(), botOpt);
  }

  async sendVideoNote(
    chatId: string,
    fulfillment: Fulfillment,
    session: ISession,
    botOpt: TelegramBot.SendMessageOptions = {},
  ) {
    await this.bot.sendChatAction(chatId, "record_video_note");
    const voiceFile = await this.getVoiceFile(fulfillment, session);
    const imageFile = getTmpFile("jpg");
    await Proc.spawn("convert", [
      "/Users/flaviod/Desktop/Empty/IMG_0317.HEIC",
      "-resize",
      "600x600^",
      "-gravity",
      "center",
      "-crop",
      "600x600+0+0",
      imageFile,
    ]);
    const videoNoteFile = getTmpFile("mp4");
    await Proc.spawn("ffmpeg", [
      "-loop",
      "1",
      "-i",
      imageFile,
      "-i",
      voiceFile,
      "-c:v",
      "libx264",
      "-tune",
      "stillimage",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-pix_fmt",
      "yuv420p",
      "-shortest",
      videoNoteFile,
    ]);
    return this.bot.sendVideoNote(chatId, videoNoteFile, botOpt);
  }

  getIsMention(text: string) {
    return this.botMentionRegex.test(text);
  }

  getIsActivator(text: string) {
    return getAiNameRegex().test(text);
  }

  getIsCommand(
    e: TelegramBot.Message,
    session: ISession,
  ): ((session: ISession, bag: TelegramBag) => Promise<Fulfillment>) | false {
    for (const [rx, fn] of this.commandMapping) {
      const matches = e.text.match(rx);
      if (matches) {
        if (
          !session.authorizations.includes(IOManager.Authorizations.COMMAND) &&
          !session.authorizations.includes(IOManager.Authorizations.ADMIN)
        ) {
          return () => this.commandNotAuthorized();
        }

        return (session: ISession, bag: TelegramBag) => fn(matches, session, bag);
      }
    }

    return false;
  }

  getIsGroup(msg: TelegramBot.Message) {
    return msg.chat.type === "group";
  }

  private async parseMessage(e: TelegramBot.Message) {
    const sessionId = `u${e.from.id}c${e.chat.id}`;

    const session = await IOManager.registerSession(DRIVER_ID, sessionId, { from: e.from, chat: e.chat });

    const bag: TelegramBag = {
      encodable: {
        replyToMessageId: e.message_id,
      },
    };

    const isCommand = this.getIsCommand(e, session);

    const isGroup = this.getIsGroup(e);
    const isMention = this.getIsMention(e.text);
    const isActivator = this.getIsActivator(e.text);
    const isReply = e.reply_to_message?.from?.id === this.botMe.id;

    return { session, bag, isGroup, isMention, isActivator, isReply, isCommand };
  }

  async onBotInput(e: TelegramBot.Message) {
    console.info(TAG, "input");
    console.dir(e, {
      depth: 2,
    });

    // Register the session
    const { session, bag, isGroup, isMention, isReply, isActivator, isCommand } = await this.parseMessage(e);

    console.info(TAG, `session = ${session.id}`);

    // Process a command
    if (isCommand) {
      let fulfillment = null;
      try {
        fulfillment = await isCommand(session, bag);
      } catch (err) {
        fulfillment = { payload: { error: err } };
      }
      await IOManager.output(fulfillment, session, bag);
      return true;
    }

    // Process a Text object
    if (e.text) {
      // If we are in a group, only listen for activators
      if (isGroup && !(isMention || isReply || isActivator)) {
        console.debug(TAG, "skipping input for missing activator");
        return false;
      }

      // Clean
      const text = this.cleanInputText(e);
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
        console.debug(TAG, "skipping input for missing activator");
        return false;
      }

      // User sent a voice note, respond with a voice note :)
      this.emitter.emit("input", {
        session,
        params: {
          text,
          bag: { ...bag, respondWithAudioNote: true },
        },
      });

      return true;
    }

    // Process a Photo Object
    if (e.photo) {
      const photoLink = this.bot.getFileLink(e.photo[e.photo.length - 1].file_id);
      if (isGroup) return false;

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

    this.emitter.emit("input", {
      session,
      error: {
        unkownInputType: true,
      },
    });
    return true;
  }

  private async commandNotAuthorized(): Promise<Fulfillment> {
    return { fulfillmentText: "User not authorized" };
  }

  private async commandNotFound(): Promise<Fulfillment> {
    return { fulfillmentText: "Command not found" };
  }

  private async commandAppStop(): Promise<Fulfillment> {
    setTimeout(() => process.exit(0), 5000);
    return { fulfillmentText: "Scheduled shutdown in 5 seconds" };
  }

  private async commandFindSessionByName([, opt]: RegExpMatchArray): Promise<Fulfillment> {
    const result = await Session.findOne(JSON.parse(opt));
    return { payload: { data: JSON.stringify(result, null, 2) } };
  }

  private async commandOut([, cmdSessionId, cmdText]: RegExpMatchArray): Promise<Fulfillment> {
    const cmdSession = await IOManager.getSession(cmdSessionId);
    const result = await IOManager.output({ fulfillmentText: cmdText }, cmdSession, {});
    return { payload: { data: JSON.stringify(result, null, 2) } };
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
      console.error(TAG, "webhook error", err);
    });

    // We could attach the webhook to the Router API or via polling
    if (this.config.options.polling === false) {
      this.bot.setWebHook(
        [config().server.protocol, "://", config().server.domain, "/io/telegram/bot", this.config.token].join(""),
      );
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
  async output(f: Fulfillment, session: ISession, bag: TelegramBag): Promise<boolean> {
    let processed = false;

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
      if (f.fulfillmentText) {
        await this.sendMessage(chatId, f.fulfillmentText, botOpt);
        // await this.sendVideoNote(chatId, f, session, botOpt);

        if (bag?.encodable.respondWithAudioNote || f.payload?.includeVoice) {
          await this.sendAudioNote(chatId, f, session, botOpt);
        }
        processed = true;
      }
    } catch (err) {
      console.error(TAG, err);
    }

    // Process a URL Object
    try {
      if (f.payload?.url) {
        await this.bot.sendMessage(chatId, f.payload.url, botOpt);
        processed = true;
      }
    } catch (err) {
      console.error(TAG, err);
    }

    // Process a Video object
    try {
      if (f.payload?.video?.uri) {
        await this.bot.sendChatAction(chatId, "upload_video");
        await this.bot.sendVideo(chatId, f.payload.video.uri, botOpt);
      }
      processed = true;
    } catch (err) {
      console.error(TAG, err);
    }

    // Process an Image Object
    try {
      if (f.payload?.image?.uri) {
        await this.bot.sendChatAction(chatId, "upload_photo");
        await this.bot.sendPhoto(chatId, f.payload.image.uri, botOpt);
      }
      processed = true;
    } catch (err) {
      console.error(TAG, err);
    }

    // Process an Audio Object
    try {
      if (f.payload?.audio?.uri) {
        await this.bot.sendChatAction(chatId, "upload_audio");
        await this.bot.sendAudio(chatId, f.payload.audio.uri, botOpt);
      }
      processed = true;
    } catch (err) {
      console.error(TAG, err);
    }

    // Process a Document Object
    try {
      if (f.payload?.document?.uri) {
        await this.bot.sendChatAction(chatId, "upload_document");
        await this.bot.sendDocument(chatId, f.payload.document.uri, botOpt);
      }
      processed = true;
    } catch (err) {
      console.error(TAG, err);
    }

    try {
      if (f.payload?.error?.message) {
        await this.sendMessage(chatId, `<pre>${f.payload.error.toString()}</pre>`, botOpt);
        processed = true;
      }
    } catch (err) {
      console.error(TAG, err);
    }

    try {
      if (f.payload?.data) {
        await this.sendMessage(chatId, `<pre>${f.payload?.data}</pre>`, botOpt);
        processed = true;
      }
    } catch (err) {
      console.error(TAG, err);
    }

    // ---- Telegram specific Objects ----

    // Process a Sticker Object
    try {
      if (f.payload?.telegram?.sticker) {
        await this.bot.sendSticker(chatId, f.payload.telegram.sticker, botOpt);
        processed = true;
      }
    } catch (err) {
      console.error(TAG, err);
    }

    return processed;
  }
}

export default new Telegram(config().telegram);
