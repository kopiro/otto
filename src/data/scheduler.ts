import { DocumentType, Ref, getModelForClass, modelOptions, plugin, prop } from "@typegoose/typegoose";
import { IIOChannel } from "./io-channel";
import autopopulate from "mongoose-autopopulate";
import { IPerson } from "./person";

@modelOptions({ schemaOptions: { collection: "scheduler" } })
@plugin(autopopulate)
export class IScheduler {
  @prop({ autopopulate: { maxDepth: 1 }, ref: () => IIOChannel })
  public ioChannel!: Ref<IIOChannel>;

  @prop({ autopopulate: { maxDepth: 1 }, ref: () => IPerson })
  public person?: Ref<IPerson>;

  @prop({ required: true })
  public managerUid!: string;

  @prop({ required: true })
  public programName!: string;

  @prop({ required: true })
  public programArgs!: Record<string, any>;

  @prop()
  public yearly?: string; // set "dayofyear hour:minute:second"

  @prop()
  public monthly?: string; // set "dayofmonth hour:minute:second"

  @prop()
  public weekly?: string; // set "dayofweek hour:minute:second"

  @prop()
  public daily?: string; // set "hour:minute:second"

  @prop()
  public hourly?: string; // set minute:second

  @prop()
  public minutely?: string; // set second

  @prop()
  public everyHalfHour?: boolean;

  @prop()
  public everyQuartelyHour?: boolean;

  @prop()
  public everyFiveMinutes?: boolean;

  @prop()
  public onTick?: boolean; // every second

  @prop()
  public onBoot?: boolean; // every boot

  @prop()
  public onDate?: string; // on a date

  @prop()
  public onDateISOString?: string; // on a date iso strin

  @prop()
  public deleteAfterRun?: boolean;
}

export const Scheduler = getModelForClass(IScheduler);
export type TScheduler = DocumentType<IScheduler>;
