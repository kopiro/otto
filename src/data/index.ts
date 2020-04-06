import mongoose from "mongoose";
import autopopulate from "mongoose-autopopulate";
import { SessionSchema } from "./session";
import { Session as ISession, IOQueue as IIOQueue, Scheduler as IScheduler } from "../types";

const { Schema } = mongoose;

export const Session = mongoose.model<ISession>("session", SessionSchema);

export const ServerSettings = mongoose.model(
  "server_settings",
  new Schema({
    _id: String,
    data: Schema.Types.Mixed,
  }),
);

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
  onTick: Boolean, // every second
  onDate: String, // on a date
});
SchedulerSchema.plugin(autopopulate);
export const Scheduler = mongoose.model<IScheduler>("scheduler", SchedulerSchema);

const ListenerSchema = new Schema({
  session: { type: String, ref: "session", autopopulate: true },
  listener: String,
});
ListenerSchema.plugin(autopopulate);
export const Listener = mongoose.model("listener", ListenerSchema);
