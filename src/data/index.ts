import mongoose from "mongoose";
import autopopulate from "mongoose-autopopulate";
import { SessionSchema } from "./session";
import {
  Session as ISession,
  IOQueue as IIOQueue,
  Scheduler as IScheduler,
  FindMyDevice as IFindMyDevice,
} from "../types";

const { Schema } = mongoose;

export const Session = mongoose.model<ISession>("session", SessionSchema);

const SessionInputSchema = new Schema({
  session: { type: String, ref: "session", autopopulate: true },
  createdAt: Date,
  event: Schema.Types.Mixed,
  text: String,
});
SessionInputSchema.plugin(autopopulate);
export const SessionInput = mongoose.model("session_input", SessionInputSchema);

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

const FindMyDeviceSchema = new Schema({
  name: String,
  ip: String,
  createdAt: Date,
  updatedAt: Date,
});
export const FindMyDevice = mongoose.model<IFindMyDevice>("findmydevice", FindMyDeviceSchema);
