import autopopulate from "mongoose-autopopulate";
import { IOBag, IODriverId } from "../stdlib/io-manager";
import { Output, Input } from "../types";
import { IIOChannel, TIOChannel } from "./io-channel";
import { DocumentType, Ref, ReturnModelType, getModelForClass, modelOptions, plugin, prop } from "@typegoose/typegoose";
import config from "../config";
import { IPerson, TPerson } from "./person";
import mongoose from "mongoose";

@modelOptions({ schemaOptions: { collection: "io_queue" }, options: { allowMixed: 0 } })
@plugin(autopopulate)
class IIOQueue {
  @prop({ required: true })
  public managerUid!: string;

  @prop({ autopopulate: true, ref: () => IIOChannel })
  ioChannel!: Ref<IIOChannel>;

  @prop({ autopopulate: true, ref: () => IPerson })
  person!: Ref<IPerson>;

  @prop({ required: true })
  public createdAt!: Date;

  @prop({ required: false })
  public input!: Input;

  @prop({ required: false })
  public output!: Output;

  @prop()
  public bag!: IOBag;

  static async createNew(
    this: ReturnModelType<typeof IIOQueue>,
    data: { input: Input } | { output: Output },
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
