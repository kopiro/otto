import autopopulate from "mongoose-autopopulate";
import { IOBag, IODriverId } from "../stdlib/io-manager";
import { Fulfillment, InputParams } from "../types";
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
  public input!: InputParams;

  @prop({ required: false })
  public fulfillment!: Fulfillment;

  @prop()
  public bag!: IOBag;

  static async createNew(
    this: ReturnModelType<typeof IIOQueue>,
    data: { input: InputParams } | { fulfillment: Fulfillment },
    ioChannel: TIOChannel,
    person: TPerson,
    bag: IOBag | null,
  ) {
    return IOQueue.create({
      ...data,
      createdAt: new Date(),
      managerUid: ioChannel.managerUid,
      ioChannel: ioChannel.id,
      person: person.id,
      bag,
    });
  }

  static async getNextInQueue(this: ReturnModelType<typeof IIOQueue>) {
    return IOQueue.findOne({
      managerUid: config().uid,
    }).sort({ createdAt: 1 });
  }
}

export const IOQueue = getModelForClass(IIOQueue);
export type TIOQueue = DocumentType<IIOQueue>;
