const _ = require('underscore');
const Schema = mongoose.Schema;
const autopopulate = require('mongoose-autopopulate');

const ServerSettings = new Schema({
	_id: String,
	data: Schema.Types.Mixed
});
exports.ServerSettings = mongoose.model('settings', ServerSettings);

const Session = new Schema({
	_id: String,
	io_driver: String,
	io_id: String,
	io_data: Schema.Types.Mixed,
	server_settings: { type: String, ref: 'server_settings', autopopulate: true },
	settings: Schema.Types.Mixed,
	translate_from: String,
	translate_to: String,
	alias: String,
	is_admin: Boolean,
	pipe: Schema.Types.Mixed
});

Session.plugin(autopopulate);

Session.methods.saveServerSettings = async function(data) {
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

Session.methods.getIODriver = function() {
	return IOManager.getDriver(this.io_driver);
};

Session.methods.savePipe = function(data) {
	this.pipe = _.extend(this.pipe || {}, data);
	this.markModified('pipe');
	return this.save();
};

Session.methods.saveSettings = function(data) {
	this.pipe = _.extend(this.settings || {}, data);
	this.markModified('settings');
	return this.save();
};

Session.methods.getTranslateFrom = function() {
	return this.translate_from || config.language;
};

Session.methods.getTranslateTo = function() {
	return this.translate_to || config.language;
};

exports.Session = mongoose.model('session', Session);

const SessionInput = new Schema({
	session: { type: String, ref: 'session', autopopulate: true },
	text: String,
});
SessionInput.plugin(autopopulate);
exports.SessionInput = mongoose.model('session_input', SessionInput);

const IOQueue = new Schema({
	session: { type: String, ref: 'session', autopopulate: true },
	driver: String,
	params: Schema.Types.Mixed,
	fulfillment: Schema.Types.Mixed,
	io_id: String
});
IOQueue.plugin(autopopulate);
exports.IOQueue = mongoose.model('io_queue', IOQueue);

const Story = new Schema({
	title: String,
	text: String,
	tags: String,
	url: String,
	date: Date,
	image: Schema.Types.Mixed,
	facebook: Schema.Types.Mixed,
});
exports.Story = mongoose.model('stories', Story);

const Vision = new Schema({
	url: String,
	labels: String,
	date: Date
});
exports.Vision = mongoose.model('vision', Vision);

const Scheduler = new Schema({
	session: { type: String, ref: 'session', autopopulate: true },
	manager_uid: String,
	program: String,
	program_data: Schema.Types.Mixed,
	yearly: String, // set "dayofyear hour:minute"
	monthly: String, // set "dayofmonth hour:minute"
	weekly: String, // set "dayofweek hour:minute"
	daily: String, // set "hour:minute"
	hourly: String, // set minute
	on_tick: Boolean, // every second
	on_date: String // on a date
});
Scheduler.plugin(autopopulate);
exports.Scheduler = mongoose.model('scheduler', Scheduler);

const Knowledge = new Schema({
	input: String,
	output: String,
	session: { type: String, ref: 'session', autopopulate: true },
	score: Number
});
Knowledge.plugin(autopopulate);
exports.Knowledge = mongoose.model('knowledge', Knowledge);

const Music = new Schema({
	name: String,
	artist: String,
	url: String
});
exports.Music = mongoose.model('musics', Music);

const Listener = new Schema({
	session: { type: String, ref: 'session', autopopulate: true },
	listener: String
});
Listener.plugin(autopopulate);
exports.Listener = mongoose.model('listener', Listener);
