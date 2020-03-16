const mongoose = require("mongoose");
const autopopulate = require("mongoose-autopopulate");

const { Schema } = mongoose;

const Session = mongoose.model("session", require("./session"));

const ServerSettings = mongoose.model(
  "server_settings",
  new Schema({
    _id: String,
    data: Schema.Types.Mixed
  })
);

const SessionInputSchema = new Schema({
  session: { type: String, ref: "session", autopopulate: true },
  createdAt: Date,
  event: Schema.Types.Mixed,
  text: String
});
SessionInputSchema.plugin(autopopulate);
const SessionInput = mongoose.model("session_input", SessionInputSchema);

const IOQueueSchema = new Schema({
  ioId: String,
  session: { type: String, ref: "session", autopopulate: true },
  driver: String,
  params: Schema.Types.Mixed,
  fulfillment: Schema.Types.Mixed
});
IOQueueSchema.plugin(autopopulate);
const IOQueue = mongoose.model("io_queue", IOQueueSchema);

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
  onDate: String // on a date
});
SchedulerSchema.plugin(autopopulate);
const Scheduler = mongoose.model("scheduler", SchedulerSchema);

const ListenerSchema = new Schema({
  session: { type: String, ref: "session", autopopulate: true },
  listener: String
});
ListenerSchema.plugin(autopopulate);
const Listener = mongoose.model("listener", ListenerSchema);

module.exports = {
  Session,
  Listener,
  IOQueue,
  Scheduler,
  SessionInput,
  ServerSettings
};
