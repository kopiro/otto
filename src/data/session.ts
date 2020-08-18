import mongoose from "mongoose";
import autopopulate from "mongoose-autopopulate";
import { ServerSettings } from "./index";
import config from "../config";
import { Language } from "../types";
const { Schema } = mongoose;

export const SessionSchema = new Schema({
  _id: String,
  ioDriver: String,
  ioId: String,
  ioData: Schema.Types.Mixed,
  serverSettings: {
    type: String,
    ref: "server_settings",
    autopopulate: true,
  },
  settings: Schema.Types.Mixed,
  translateFrom: String,
  translateTo: String,
  pipe: Schema.Types.Mixed,
  authorizations: [String],
  fallbackSession: { type: String, ref: "session", autopopulate: true },
  redirectSessions: [{ type: String, ref: "session", autopopulate: true }],
  forwardSessions: [{ type: String, ref: "session", autopopulate: true }],
  repeatModeSessions: [{ type: String, ref: "session", autopopulate: true }],
});

SessionSchema.plugin(autopopulate);

/**
 * Save new settings in DB
 */
SessionSchema.methods.saveServerSettings = async function (data: {}): Promise<boolean> {
  let s = this.serverSettings;
  if (s == null) {
    s = new ServerSettings({
      _id: this.populated("serverSettings") || this._id,
    });
  }
  s.data = { ...s.data, ...data };
  s.markModified("data");
  return s.save();
};

/**
 * Save new data in pipe in DB
 */
SessionSchema.methods.savePipe = async function (data: {}): Promise<boolean> {
  this.pipe = { ...(this.pipe || {}), ...data };
  this.pipe.updated_at = Date.now();
  this.markModified("pipe");
  return this.save();
};

/**
 * Save new settings in DB
 */
SessionSchema.methods.saveSettings = async function (data: {}): Promise<boolean> {
  this.settings = { ...(this.settings || {}), ...data };
  this.settings.updated_at = Date.now();
  this.markModified("settings");
  return this.save();
};

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
