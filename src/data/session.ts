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
  alias: String,
  isAdmin: Boolean,
  pipe: Schema.Types.Mixed,
  fallbackSession: { type: String, ref: "session", autopopulate: true },
  redirectSession: { type: String, ref: "session", autopopulate: true },
  forwardSession: { type: String, ref: "session", autopopulate: true },
  repeatModeSession: { type: String, ref: "session", autopopulate: true },
});

SessionSchema.plugin(autopopulate);

/**
 * Save new settings in DB
 *
 */
SessionSchema.methods.saveServerSettings = async (data: {}): Promise<boolean> => {
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
 *
 */
SessionSchema.methods.savePipe = async (data: {}): Promise<boolean> => {
  this.pipe = { ...(this.pipe || {}), ...data };
  this.pipe.updated_at = Date.now();
  this.markModified("pipe");
  return this.save();
};

/**
 * Save new settings in DB
 *
 */
SessionSchema.methods.saveSettings = async (data: {}): Promise<boolean> => {
  this.settings = { ...(this.settings || {}), ...data };
  this.settings.updated_at = Date.now();
  this.markModified("settings");
  return this.save();
};

/**
 * Get the language to translate from
 */
SessionSchema.methods.getTranslateFrom = (): Language => {
  return this.translateFrom || config().language;
};

/**
 * Get the language to translate to
 */
SessionSchema.methods.getTranslateTo = (): Language => {
  return this.translateTo || config().language;
};
