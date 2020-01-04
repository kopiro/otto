const mongoose = require("mongoose");
const autopopulate = require("mongoose-autopopulate");
const { ServerSettings } = require("./index");
const config = require("../config");

const { Schema } = mongoose;

const Session = new Schema({
  _id: String,
  ioDriver: String,
  ioId: String,
  ioData: Schema.Types.Mixed,
  serverSettings: {
    type: String,
    ref: "server_settings",
    autopopulate: true
  },
  settings: Schema.Types.Mixed,
  translateFrom: String,
  translateTo: String,
  alias: String,
  isAdmin: Boolean,
  pipe: Schema.Types.Mixed,
  fallbackSession: { type: String, ref: "session", autopopulate: true },
  redirectSession: { type: String, ref: "session", autopopulate: true },
  repeatModeSession: { type: String, ref: "session", autopopulate: true }
});

Session.plugin(autopopulate);

/**
 * Save new settings in DB
 * @param {Object} data
 */
Session.methods.saveServerSettings = async function saveServerSettings(data) {
  let s = this.serverSettings;
  if (s == null) {
    s = new ServerSettings({
      _id: this.populated("serverSettings") || this._id
    });
  }
  s.data = { ...s.data, ...data };
  s.markModified("data");
  s.save();
};

/**
 * Save new data in pipe in DB
 * @param {Object} data
 */
Session.methods.savePipe = async function savePipe(data) {
  this.pipe = { ...(this.pipe || {}), ...data };
  this.pipe.updated_at = Date.now();
  this.markModified("pipe");
  await this.save();
};

/**
 * Save new settings in DB
 * @param {Object} data
 */
Session.methods.saveSettings = async function saveSettings(data) {
  this.settings = { ...(this.settings || {}), ...data };
  this.settings.updated_at = Date.now();
  this.markModified("settings");
  await this.save();
};

/**
 * Get the language to translate from
 */
Session.methods.getTranslateFrom = function getTranslateFrom() {
  return this.translateFrom || config.language;
};

/**
 * Get the language to translate to
 */
Session.methods.getTranslateTo = function getTranslateTo() {
  return this.translateTo || config.language;
};

module.exports = Session;
