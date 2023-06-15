import { Fulfillment, InputParams } from "../types";
import { DocumentType, Ref, ReturnModelType, getModelForClass, modelOptions, plugin, prop } from "@typegoose/typegoose";
import { ISession, TSession } from "./session";
import autopopulate from "mongoose-autopopulate";
import config from "../config";

@modelOptions({ schemaOptions: { collection: "interactions" } })
@plugin(autopopulate)
class IInteraction {
  @prop({ required: true })
  public managerUid!: string;

  @prop({ autopopulate: { maxDepth: 1 }, ref: () => ISession })
  public session!: Ref<ISession>;

  @prop()
  public reducedAt?: Date;

  @prop({ required: true })
  public createdAt!: Date;

  @prop()
  public source?: string;

  @prop()
  public input?: InputParams;

  @prop()
  public fulfillment?: Fulfillment;

  static async createNew(this: ReturnModelType<typeof IInteraction>, session: TSession, params: Partial<TInteraction>) {
    const e = new Interaction({
      managerUid: config().uid,
      session: session.id,
      createdAt: new Date(),
      ...params,
    });
    return e.save();
  }
}

export const Interaction = getModelForClass(IInteraction);
export type TInteraction = DocumentType<IInteraction>;
