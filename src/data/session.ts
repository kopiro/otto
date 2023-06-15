import config from "../config";
import { IODataTelegram } from "../io/telegram";
import { IODriverId } from "../stdlib/iomanager";
import { Authorizations, Language } from "../types";
import { getModelForClass, Ref, ReturnModelType, DocumentType, prop, modelOptions } from "@typegoose/typegoose";

import { Signale } from "signale";

const TAG = "Session";
const logger = new Signale({
  scope: TAG,
});

@modelOptions({ schemaOptions: { collection: "sessions" } })
export class ISession {
  @prop({ required: true })
  public managerUid!: string;

  @prop({ required: true })
  public ioDriver!: IODriverId;

  @prop({ required: true })
  public identifier!: string;

  @prop()
  public ioData?: Record<string, any>;

  @prop()
  public name?: string;

  @prop()
  public language?: Language;

  @prop({ type: () => [String] })
  public authorizations?: Authorizations[];

  /**
   * This property is used to redirect the output of this session to another session.
   * This is useful for example if you want to also speak when you're replying to a user.
   */
  @prop({ ref: () => ISession })
  public redirectSessions?: Ref<ISession>[];

  /**
   * Instead of using this session to kick-in the normal input/output flow,
   * the session will be used to repeat the last input of the session.
   * This way, you can simply built a bot that repeats the last input of the user.
   * For example, you can input on Telegram to output to Human.
   */
  @prop({ ref: () => ISession })
  public repeatModeSessions?: Ref<ISession>[];

  @prop()
  public doNotDisturb?: boolean;

  public getLanguage(this: DocumentType<ISession>): Language {
    switch (this.ioDriver) {
      case "telegram": {
        const ioData = this.ioData as IODataTelegram;
        return this.language || ioData.from?.language_code || config().language;
      }
      default:
        return config().language;
    }
  }

  public getName(this: DocumentType<ISession>): string {
    if (this.name) {
      return this.name;
    }

    switch (this.ioDriver) {
      case "telegram": {
        const ioData = this.ioData as IODataTelegram;
        const { first_name, last_name } = ioData?.from || {};
        if (first_name && last_name) {
          return `${first_name} ${last_name}`;
        }
        if (first_name) {
          return first_name;
        }
        return "Unknown";
      }
      default:
        return "Unknown";
    }
  }

  public getDriverName(this: DocumentType<ISession>) {
    switch (this.ioDriver) {
      case "telegram": {
        const ioData = this.ioData as IODataTelegram;
        let chatName = "";
        switch (ioData?.chat.type) {
          case "supergroup":
          case "group":
            chatName = `in the group chat "${ioData.chat.title}"`;
            break;
          case "channel":
            chatName = `in the channel "${ioData.chat.title}"`;
            break;
          case "private":
            chatName = "in a private conversation";
            break;
        }
        return `via Telegram (${chatName})`;
      }
      case "human":
      case "web":
        return "Face to face";
      default:
        return "-";
    }
  }

  static async findByIOIdentifierOrCreate(
    this: ReturnModelType<typeof ISession>,
    ioDriver: string,
    identifier: string,
    ioData: any = undefined,
  ) {
    const existingSession = await Session.findByIOIdentifier(ioDriver, identifier);

    if (existingSession) {
      // Only update ioData if it's different
      if (JSON.stringify(existingSession.ioData) !== JSON.stringify(ioData)) {
        logger.debug(
          "Updating ioData for existing session, ioData = ",
          ioData,
          "old ioData = ",
          existingSession.ioData,
        );
        await existingSession.updateOne({
          ioData,
        });
      }
      return existingSession;
    }

    const newSession = await Session.create({
      managerUid: config().uid,
      ioDriver: ioDriver as IODriverId,
      ioData,
      identifier,
    });

    logger.info("New session model registered", newSession);

    return newSession;
  }

  static async findByIOIdentifier(this: ReturnModelType<typeof ISession>, ioDriver: string, identifier: string) {
    return Session.findOne({
      managerUid: config().uid,
      ioDriver,
      identifier,
    });
  }
}

export const Session = getModelForClass(ISession);
export type TSession = DocumentType<ISession>;
