const Schema = mongoose.Schema;
const _ = require('underscore');

const Session = new Schema({
	_id: String,
	io_driver: String,
	io_id: String,
	io_data: Schema.Types.Mixed,
	server_settings: {
		type: String,
		ref: 'server_settings',
		autopopulate: true
	},
	settings: Schema.Types.Mixed,
	translate_from: String,
	translate_to: String,
	alias: String,
	is_admin: Boolean,
	pipe: Schema.Types.Mixed
});

Session.plugin(require('mongoose-autopopulate'));

/**
 * Save new settings in DB
 * @param {Object} data 
 */
Session.methods.saveServerSettings = async function (data) {
	let s = this.server_settings;
	if (s == null) {
		s = new exports.ServerSettings({
			_id: (this.populated('server_settings') || this._id)
		});
	}
	s.data = _.extend({}, s.data, data);
	s.markModified('data');
	return s.save();
};

/**
 * Retrieve the IO driver module
 */
Session.methods.getIODriver = function () {
	return IOManager.getDriver(this.io_driver);
};

/**
 * Save new data in pipe in DB
 * @param {Object} data 
 */
Session.methods.savePipe = function (data) {
	this.pipe = _.extend(this.pipe || {}, data);
	this.pipe.updated_at = Date.now();
	this.markModified('pipe');
	return this.save();
};

/**
 * Save new settings in DB
 * @param {Object} data 
 */
Session.methods.saveSettings = function (data) {
	this.settings = _.extend(this.settings || {}, data);
	this.settings.updated_at = Date.now();
	this.markModified('settings');
	return this.save();
};

/**
 * Get the language to translate from
 */
Session.methods.getTranslateFrom = function () {
	return this.translate_from || config.language;
};

/**
 * Get the language to translate to
 */
Session.methods.getTranslateTo = function () {
	return this.translate_to || config.language;
};

module.exports = Session;