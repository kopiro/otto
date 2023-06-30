import { Fulfillment, InputParams } from "../types";
import {
  DocumentType,
  Ref,
  ReturnModelType,
  getModelForClass,
  isDocument,
  modelOptions,
  plugin,
  prop,
} from "@typegoose/typegoose";
import { IIOChannel, TIOChannel } from "./io-channel";
import autopopulate from "mongoose-autopopulate";

@modelOptions({ schemaOptions: { collection: "memory_episodes" } })
@plugin(autopopulate)
export class IMemoryEpisode {
  @prop({ required: true })
  public managerUid!: string;

  @prop({ autopopulate: { maxDepth: 1 }, ref: () => IIOChannel })
  public ioChannel!: Ref<IIOChannel>;

  @prop({ required: true })
  public text!: string;

  @prop({ required: true })
  public date!: Date;

  @prop({ required: true })
  public createdAt!: Date;
}

export const MemoryEpisode = getModelForClass(IMemoryEpisode);
export type TMemoryEpisode = DocumentType<IMemoryEpisode>;
