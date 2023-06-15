import { DocumentType, Ref, getModelForClass, modelOptions, plugin, prop } from "@typegoose/typegoose";
import { ISession } from "./session";
import autopopulate from "mongoose-autopopulate";

@modelOptions({ schemaOptions: { collection: "schedulers" } })
@plugin(autopopulate)
export class IScheduler {
  @prop({ autopopulate: { maxDepth: 1 }, ref: () => ISession })
  public session!: Ref<ISession>;

  @prop({ required: true })
  public managerUid!: string;

  @prop({ required: true })
  public programName!: string;

  @prop({ required: true })
  public programArgs!: Record<string, string>;

  @prop()
  public yearly?: string; // set "dayofyear hour:minute"

  @prop()
  public monthly?: string; // set "dayofmonth hour:minute"

  @prop()
  public weekly?: string; // set "dayofweek hour:minute"

  @prop()
  public daily?: string; // set "hour:minute"

  @prop()
  public hourly?: string; // set minute

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
