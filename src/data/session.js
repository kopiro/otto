const mongoose = require('mongoose');
const autopopulate = require('mongoose-autopopulate');
const IOManager = require('../stdlib/iomanager');
const { ServerSettings } = require('./index');
const config = require('../config');

const { Schema } = mongoose;

const Session = new Schema({
  _id: String,
  io_driver: String,
  io_id: String,
  io_data: Schema.Types.Mixed,
  server_settings: {
    type: String,
    ref: 'server_settings',
    autopopulate: true,
  },
  settings: Schema.Types.Mixed,
  translate_from: String,
  translate_to: String,
  alias: String,
  is_admin: Boolean,
  pipe: Schema.Types.Mixed,
});

Session.plugin(autopopulate);

/**
 * Save new settings in DB
 * @param {Object} data
 */
Session.methods.saveServerSettings = async function saveServerSettings(data) {
  let s = this.server_settings;
  if (s == null) {
    s = new ServerSettings({
      _id: (this.populated('server_settings') || this._id),
    });
  }
  s.data = { ...s.data, ...data };
  s.markModified('data');
  s.save();
};

/**
 * Retrieve the IO driver module
 */
Session.methods.getIODriver = function getIODriver() {
  return IOManager.getDriver(this.io_driver);
};

/**
 * Save new data in pipe in DB
 * @param {Object} data
 */
Session.methods.savePipe = async function savePipe(data) {
  this.pipe = { ...(this.pipe || {}), ...data };
  this.pipe.updated_at = Date.now();
  this.markModified('pipe');
  await this.save();
};

/**
 * Save new settings in DB
 * @param {Object} data
 */
Session.methods.saveSettings = async function saveSettings(data) {
  this.settings = { ...(this.settings || {}), ...data };
  this.settings.updated_at = Date.now();
  this.markModified('settings');
  await this.save();
};

/**
 * Get the language to translate from
 */
Session.methods.getTranslateFrom = function getTranslateFrom() {
  return this.translate_from || config.language;
};

/**
 * Get the language to translate to
 */
Session.methods.getTranslateTo = function getTranslateTo() {
  return this.translate_to || config.language;
};

module.exports = Session;
