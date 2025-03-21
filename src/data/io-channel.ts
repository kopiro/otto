import config from "../config";
import { IODataTelegram } from "../io/telegram";
import { IOData, IODriverId } from "../stdlib/io-manager";
import {
  getModelForClass,
  Ref,
  ReturnModelType,
  DocumentType,
  prop,
  modelOptions,
  plugin,
  isDocument,
  isDocumentArray,
} from "@typegoose/typegoose";
import autopopulate from "mongoose-autopopulate";
import { Signale } from "signale";
import { IPerson, TPerson } from "./person";
import mongoose from "mongoose";

const TAG = "IOChannel";
const logger = new Signale({
  scope: TAG,
});

@modelOptions({ schemaOptions: { collection: "io_channels" }, options: { allowMixed: 0 } })
@plugin(autopopulate)
export class IIOChannel {
  public id!: string;

  @prop({ required: true })
  public managerUid!: string;

  @prop({ required: true })
  public ioDriver!: IODriverId;

  @prop({ required: true })
  public ioIdentifier!: string;

  @prop({ required: false, type: mongoose.Schema.Types.Mixed })
  public ioData!: IOData;

  @prop({ required: false, type: mongoose.Schema.Types.Mixed })
  public options?: any;

  @prop({ required: true })
  public createdAt?: Date;

  /**
   * In case there is a direct correlation between the channel and a person (DM),
   * you can use this field directly to refer to the person,
   * but this is not garantueed (example, group chats)
   */
  @prop({ required: false, autopopulate: { maxDepth: 1 }, ref: () => IPerson })
  public person?: Ref<IPerson>;

  /**
   * In case of group chats, this field will be populated with the people in the group chat
   */
  @prop({ required: false, autopopulate: { maxDepth: 1 }, ref: () => IPerson })
  public people!: Ref<IPerson>[];

  /**
   * This property is used to redirect the output of this ioChannel to another ioChannel.
   * This is useful for example if you want to also speak when you're replying to a user.
   */
  @prop({ required: false, autopopulate: { maxDepth: 1 }, ref: () => IIOChannel })
  public redirectOutputToIOChannelIds?: Ref<IIOChannel>[];

  /**
   * Instead of using this ioChannel to kick-in the normal input/output flow,
   * the ioChannel will be used to repeat the last input of the ioChannel.
   * This way, you can simply built a bot that repeats the last input of the user.
   * For example, you can input on Telegram to output to Human.
   */
  @prop({ required: false, autopopulate: { maxDepth: 1 }, ref: () => IIOChannel })
  public mirrorInputToOutputToChannelIds?: Ref<IIOChannel>[];

  /**
   * If this is true, any input/output operation will be ignored and discarded
   */
  @prop({ required: false })
  public doNotDisturb?: boolean;

  public toJSONDebug() {
    return {
      id: this.id,
      name: this.getName(),
    };
  }

  public toJSONAPI() {
    return {
      id: this.id,
      name: this.getName(),
      ownerName: this.getOwnerName(),
      ioDriver: this.ioDriver,
      ioIdentifier: this.ioIdentifier,
      ioData: this.ioData,
    };
  }

  public getOwnerName() {
    switch (this.ioDriver) {
      case "telegram": {
        const ioData = this.ioData as IODataTelegram;
        switch (ioData?.type) {
          case "supergroup":
          case "group":
          case "channel":
            return ioData.title;
          case "private":
            return [ioData.first_name, ioData.last_name].join(" ");
          default:
            return ioData.title;
        }
      }
      case "voice":
        return "Not defined";
      case "web":
        return "Not defined";
      default:
        return "Unknown";
    }
  }

  /**
   * Returns a human representation of this communication channel
   */
  public getName() {
    switch (this.ioDriver) {
      case "telegram": {
        const ioData = this.ioData as IODataTelegram;
        let chatName = "";
        switch (ioData?.type) {
          case "supergroup":
          case "group": {
            chatName = `Group: "${this.getOwnerName()}"`;
            break;
          }
          case "channel":
            chatName = `Channel: "${this.getOwnerName()}"`;
            break;
          case "private":
            chatName = `DM: "${this.getOwnerName()}"`;
            break;
        }
        return `On Telegram (${chatName})`;
      }
      case "voice":
        return "Face to face";
      case "web":
        return "On the Web interface";
      default:
        return "Unknown";
    }
  }

  static async findByIdOrThrow(this: ReturnModelType<typeof IIOChannel>, id: string): Promise<TIOChannel> {
    const ioChannel = await IOChannel.findById(id);
    if (!ioChannel) throw new Error(`IOChannel <${id}> not found`);
    return ioChannel;
  }

  static async findByIOIdentifierOrCreate(
    this: ReturnModelType<typeof IIOChannel>,
    ioDriver: string,
    ioIdentifier: string,
    ioData: IOData,
    person: TPerson | null,
    personDirectlyRelate = false,
  ): Promise<TIOChannel> {
    const ioChannel = await IOChannel.findByIOIdentifier(ioDriver, ioIdentifier);

    if (ioChannel) {
      const peopleIds = isDocumentArray(ioChannel.people) ? ioChannel.people.map((e) => e.id) : ioChannel.people || [];
      if (person && !peopleIds.includes(person.id)) {
        ioChannel.people!.push(person);
      }
      // Only update ioData if it's different
      if (JSON.stringify(ioChannel.ioData) !== JSON.stringify(ioData)) {
        logger.debug("Updating ioData for existing ioChannel, ioData = ", ioData, "old ioData = ", ioChannel.ioData);
        ioChannel.ioData = ioData;
      }
      await ioChannel.save();
      return ioChannel;
    }

    const ioChannelNew = await IOChannel.create({
      managerUid: config().uid,
      person: personDirectlyRelate ? person : undefined,
      people: person ? [person] : [],
      ioDriver,
      ioData,
      ioIdentifier,
      createdAt: new Date(),
    });

    logger.success("New IO Channel registered", ioChannelNew);

    return ioChannelNew;
  }

  static async findByIOIdentifier(
    this: ReturnModelType<typeof IIOChannel>,
    ioDriver: string,
    ioIdentifier: string,
  ): Promise<TIOChannel | null> {
    return IOChannel.findOne({
      managerUid: config().uid,
      ioDriver,
      ioIdentifier,
    });
  }
}

export const IOChannel = getModelForClass(IIOChannel);
export type TIOChannel = DocumentType<IIOChannel>;
