import { Output, Input } from "../types";
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
import { Signale } from "signale";
import { OutputSource } from "../stdlib/io-manager";

const TAG = "Interaction";
const logger = new Signale({
  scope: TAG,
});

@modelOptions({ schemaOptions: { collection: "interactions" }, options: { allowMixed: 0 } })
@plugin(autopopulate)
export class IInteraction {
  public id!: string;

  @prop({ required: true })
  public managerUid!: string;

  @prop({ autopopulate: { maxDepth: 1 }, ref: () => IIOChannel })
  public ioChannel!: Ref<IIOChannel>;

  @prop({ autopopulate: { maxDepth: 1 }, ref: () => IPerson })
  public person!: Ref<IPerson>;

  @prop({ required: false })
  public reducedTo?: string;

  @prop({ required: true })
  public createdAt!: Date;

  @prop({ required: false })
  public inputId?: string;

  @prop({ required: false, type: mongoose.Schema.Types.Mixed })
  public input?: Input;

  @prop({ required: false, type: mongoose.Schema.Types.Mixed })
  public output?: Output;

  @prop({ required: false, type: mongoose.Schema.Types.String })
  public source?: OutputSource;

  public toJSONAPI() {
    return {
      id: this.id,
      inputId: this.inputId,
      input: this.input,
      output: this.output,
      source: this.source,
      sourceName: this.getSourceName(),
      createdAt: this.createdAt,
    };
  }

  public getSourceName(): string {
    // When the AI spoke
    if (this.output) {
      return config().aiName;
    }

    // When the user spoke, or the system
    if (this.input) {
      if (this.input?.role === "system") {
        return "SYSTEM";
      }
      if (isDocument(this.person)) {
        return this.person.getName();
      }
      if (isDocument(this.ioChannel) && isDocument(this.ioChannel.person)) {
        return this.ioChannel.person.getName();
      }
    }

    logger.warn("Unable to determine source name for interaction", this);

    return "-";
  }

  static async createNew(
    this: ReturnModelType<typeof IInteraction>,
    data: { input: Input } | { output: Output },
    ioChannel: TIOChannel,
    person: TPerson,
    inputId: string | null,
    source: OutputSource | null,
  ) {
    if (process.env.NODE_ENV === "development") {
      logger.warn(`Skipping interaction creation in development mode`);
      return;
    }

    return Interaction.create({
      ...data,
      managerUid: config().uid,
      ioChannel: ioChannel.id,
      person: person.id,
      createdAt: new Date(),
      inputId,
      source,
    });
  }
}

export const Interaction = getModelForClass(IInteraction);
export type TInteraction = DocumentType<IInteraction>;
