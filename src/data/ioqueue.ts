import autopopulate from "mongoose-autopopulate";
import { IOBag, IODriverId } from "../stdlib/iomanager";
import { Fulfillment } from "../types";
import { ISession, TSession } from "./session";
import { DocumentType, Ref, ReturnModelType, getModelForClass, modelOptions, plugin, prop } from "@typegoose/typegoose";
import config from "../config";

@modelOptions({ schemaOptions: { collection: "io_queues" } })
@plugin(autopopulate)
class IIOQueue {
  @prop({ required: true })
  public managerUid!: string;

  @prop({ required: true })
  public ioDriver!: IODriverId;

  @prop({ autopopulate: { maxDepth: 1 }, ref: () => ISession })
  session!: Ref<ISession>;

  @prop({ required: true })
  public createdAt!: Date;

  @prop({ required: true })
  public fulfillment!: Fulfillment;

  @prop()
  public bag?: IOBag;

  static async createNew(
    this: ReturnModelType<typeof IIOQueue>,
    session: TSession,
    fulfillment: Fulfillment,
    bag?: IOBag,
  ) {
    return IOQueue.create({
      managerUid: session.managerUid,
      ioDriver: session.ioDriver,
      session: session.id,
      fulfillment,
      bag,
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
