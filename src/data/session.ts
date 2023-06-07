import mongoose from "mongoose";
import autopopulate from "mongoose-autopopulate";
import { Session as ISession } from "../types";

const { Schema } = mongoose;

export const SessionSchema = new Schema<ISession>({
  _id: String,
  ioDriver: String,
  ioId: String,
  ioData: Schema.Types.Mixed,

  name: String,

  translateFrom: String,
  translateTo: String,

  doNotDisturb: Boolean,
  timeZone: String,

  authorizations: [String],

  fallbackSession: { type: String, ref: "session", autopopulate: true },
  redirectSessions: [{ type: String, ref: "session", autopopulate: true }],
  forwardSessions: [{ type: String, ref: "session", autopopulate: true }],
  repeatModeSessions: [{ type: String, ref: "session", autopopulate: true }],
});

SessionSchema.plugin(autopopulate);
