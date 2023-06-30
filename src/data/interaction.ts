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
import config from "../config";
import { IPerson, TPerson } from "./person";
import mongoose from "mongoose";

@modelOptions({ schemaOptions: { collection: "interactions" }, options: { allowMixed: 0 } })
@plugin(autopopulate)
export class IInteraction {
  @prop({ required: true })
  public managerUid!: string;

  @prop({ autopopulate: { maxDepth: 1 }, ref: () => IIOChannel })
  public ioChannel!: Ref<IIOChannel>;

  @prop({ autopopulate: { maxDepth: 1 }, ref: () => IPerson })
  public person?: Ref<IPerson>;

  @prop({ required: false })
  public reducedTo?: string;

  @prop({ required: true })
  public createdAt!: Date;

  @prop({ required: true })
  public inputId?: string;

  @prop({ required: false, type: mongoose.Schema.Types.Mixed })
  public input?: InputParams;

  @prop({ required: false, type: mongoose.Schema.Types.Mixed })
  public fulfillment?: Fulfillment;

  getPersonName(this: TInteraction): string {
    if (isDocument(this.person)) {
      return this.person.name;
    }
    if (this.input?.role === "system") {
      return "SYSTEM";
    }
    if (this.fulfillment) {
      return config().aiName.toUpperCase();
    }
    return "UNKNOWN";
  }

  getSourceName(this: TInteraction): string {
    if (this.fulfillment) {
      return config().aiName.toUpperCase();
    } else if (this.input) {
      if (isDocument(this.person)) {
        return this.person.name;
      }
      return "UNKNOWN";
    }
    return "-";
  }

  static async createNew(
    this: ReturnModelType<typeof IInteraction>,
    rest: { input: InputParams } | { fulfillment: Fulfillment },
    ioChannel: TIOChannel,
    person: TPerson | null,
    inputId: string,
  ) {
    return Interaction.create({
      ...rest,
      managerUid: config().uid,
      ioChannel: ioChannel.id,
      person: person?.id,
      createdAt: new Date(),
      inputId,
    });
  }
}

export const Interaction = getModelForClass(IInteraction);
export type TInteraction = DocumentType<IInteraction>;
