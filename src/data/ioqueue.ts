import autopopulate from "mongoose-autopopulate";
import { IOBag, IODriverId } from "../stdlib/iomanager";
import { Fulfillment } from "../types";
import { ISession } from "./session";
import { DocumentType, Ref, getModelForClass, modelOptions, plugin, prop } from "@typegoose/typegoose";

@modelOptions({ schemaOptions: { collection: "io_queues" } })
@plugin(autopopulate)
class IIOQueue {
  @prop({ required: true })
  public managerUid!: string;

  @prop({ required: true })
  public ioDriver!: IODriverId;

  @prop({ required: true })
  public createdAt!: Date;

  @prop({ autopopulate: { maxDepth: 1 }, ref: () => ISession })
  session!: Ref<ISession>;

  @prop({ required: true })
  public fulfillment!: Fulfillment;

  @prop()
  public bag?: IOBag;
}

export const IOQueue = getModelForClass(IIOQueue);
export type TIOQueue = DocumentType<IIOQueue>;
