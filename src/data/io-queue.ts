import autopopulate from "mongoose-autopopulate";
import { IOBag, IODriverId } from "../stdlib/io-manager";
import { Fulfillment } from "../types";
import { IIOChannel, TIOChannel } from "./io-channel";
import { DocumentType, Ref, ReturnModelType, getModelForClass, modelOptions, plugin, prop } from "@typegoose/typegoose";
import config from "../config";
import { IPerson, TPerson } from "./person";

@modelOptions({ schemaOptions: { collection: "io_queue" }, options: { allowMixed: 0 } })
@plugin(autopopulate)
class IIOQueue {
  @prop({ required: true })
  public managerUid!: string;

  @prop({ required: true })
  public ioDriver!: IODriverId;

  @prop({ autopopulate: { maxDepth: 1 }, ref: () => IIOChannel })
  ioChannel!: Ref<IIOChannel>;

  @prop({ autopopulate: { maxDepth: 1 }, ref: () => IPerson })
  person!: Ref<IPerson>;

  @prop({ required: true })
  public createdAt!: Date;

  @prop({ required: false })
  public inputId!: string;

  @prop({ required: true })
  public fulfillment!: Fulfillment;

  @prop()
  public bag!: IOBag;

  static async createNew(
    this: ReturnModelType<typeof IIOQueue>,
    fulfillment: Fulfillment,
    ioChannel: TIOChannel,
    person: TPerson,
    bag: IOBag | null,
    inputId: string | null,
  ) {
    return IOQueue.create({
      managerUid: ioChannel.managerUid,
      ioDriver: ioChannel.ioDriver,
      ioChannel: ioChannel.id,
      person: person.id,
      fulfillment,
      bag,
      inputId,
      createdAt: new Date(),
    });
  }

  static async getNextInQueue(this: ReturnModelType<typeof IIOQueue>, enabledDrivers: IODriverId[]) {
    return IOQueue.findOne({
      managerUid: config().uid,
      ioDriver: { $in: enabledDrivers },
    }).sort({ createdAt: 1 });
  }
}

export const IOQueue = getModelForClass(IIOQueue);
export type TIOQueue = DocumentType<IIOQueue>;
