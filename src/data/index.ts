import mongoose from "mongoose";
import autopopulate from "mongoose-autopopulate";
import { SessionSchema } from "./session";
import {
  Session as ISession,
  IOQueue as IIOQueue,
  Scheduler as IScheduler,
  Interaction as IInteraction,
  LongTermMemory as ILongTermMemory,
} from "../types";

const { Schema } = mongoose;

export const Session = mongoose.model<ISession>("session", SessionSchema);

const InteractionSchema = new Schema<IInteraction>({
  managerUid: String,
  session: { type: String, ref: "session", autopopulate: true },
  reducedLongTermMemory: { type: String, ref: "long_term_memory", autopopulate: true },
  createdAt: Date,
  input: {
    text: String,
    event: { name: String, parameters: Schema.Types.Mixed },
    command: String,
  },
  fulfillment: {
    text: String,
  },
  source: String,
});
InteractionSchema.plugin(autopopulate);
export const Interaction = mongoose.model("interaction", InteractionSchema);

const LongTermMemorySchema = new Schema<ILongTermMemory>({
  managerUid: String,
  text: String,
  createdAt: Date,
  type: String,
  forDate: Date,
});
LongTermMemorySchema.plugin(autopopulate);
export const LongTermMemory = mongoose.model("long_term_memory", LongTermMemorySchema);

const IOQueueSchema = new Schema({
  ioId: String,
  session: { type: String, ref: "session", autopopulate: true },
  fulfillment: Schema.Types.Mixed,
  bag: Schema.Types.Mixed,
});
IOQueueSchema.plugin(autopopulate);
export const IOQueue = mongoose.model<IIOQueue>("io_queue", IOQueueSchema);

const SchedulerSchema = new Schema({
  session: { type: String, ref: "session", autopopulate: true },
  managerUid: String,
  programName: String,
  programArgs: Schema.Types.Mixed,
  yearly: String, // set "dayofyear hour:minute"
  monthly: String, // set "dayofmonth hour:minute"
  weekly: String, // set "dayofweek hour:minute"
  daily: String, // set "hour:minute"
  hourly: String, // set minute
  minutely: String, // set second
  everyHalfHour: Boolean,
  everyQuartelyHour: Boolean,
  everyFiveMinutes: Boolean,
  onTick: Boolean, // every second
  onBoot: Boolean, // every boot
  onDate: String, // on a date
  onDateISOString: String, // on a date iso strin
  deleteAfterRun: Boolean,
});
SchedulerSchema.plugin(autopopulate);
export const Scheduler = mongoose.model<IScheduler>("scheduler", SchedulerSchema);
