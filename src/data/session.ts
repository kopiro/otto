import mongoose from "mongoose";
import autopopulate from "mongoose-autopopulate";
import config from "../config";
import { Language } from "../types";

const { Schema } = mongoose;

export const SessionSchema = new Schema({
  _id: String,
  ioDriver: String,
  ioId: String,
  ioData: Schema.Types.Mixed,
  translateFrom: String,
  translateTo: String,
  openaiMessages: Schema.Types.Mixed,
  openaiLastInteraction: Number,
  doNotDisturb: Boolean,
  authorizations: [String],
  fallbackSession: { type: String, ref: "session", autopopulate: true },
  redirectSessions: [{ type: String, ref: "session", autopopulate: true }],
  forwardSessions: [{ type: String, ref: "session", autopopulate: true }],
  repeatModeSessions: [{ type: String, ref: "session", autopopulate: true }],
});

SessionSchema.plugin(autopopulate);

/**
 * Get the language to translate from
 */
SessionSchema.methods.getTranslateFrom = function (): Language {
  return this.translateFrom || config().language;
};

/**
 * Get the language to translate to
 */
SessionSchema.methods.getTranslateTo = function (): Language {
  return this.translateTo || config().language;
};

SessionSchema.methods.getName = function (): Language {
  if (this.name) return this.name;
  if (this.ioDriver === "telegram") {
    const { first_name, last_name } = this.ioData.from;
    if (last_name) return `${first_name} ${last_name}`;
    return first_name;
  }
  return "Human";
};
