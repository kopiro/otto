const _ = require('underscore');
const Schema = mongoose.Schema;

const Settings = new Schema({
	key: String,
	value: Schema.Types.Mixed
});
exports.Settings = mongoose.model('setting', Settings);

const Session = new Schema({
	_id: String,
	io_id: String,
	io_data: Schema.Types.Mixed,
	contact: { type: Schema.Types.ObjectId, ref: 'contact' },
	debug: Boolean,
	approved: Boolean,
	translate_from: String,
	translate_to: String,
	pipe: Schema.Types.Mixed
});

Session.methods.saveInPipe = function(data) {
	this.pipe = _.extend(this.pipe || {}, data);
	this.markModified('pipe');
	return this.save();
};

Session.methods.getPipe = function() {
	return this.pipe || {};
};

exports.Session = mongoose.model('session', Session);

const SessionInput = new Schema({
	session: { type: String, ref: 'session' },
	text: String,
});
exports.SessionInput = mongoose.model('session_input', SessionInput);

const IOQueue = new Schema({
	session: { type: String, ref: 'session' },
	data: Schema.Types.Mixed,
});
exports.IOQueue = mongoose.model('io_queue', IOQueue);

const IOPending = new Schema({
	session: { type: String, ref: 'session' },
	action: String,
	data: Schema.Types.Mixed,
});
exports.IOPending = mongoose.model('io_pending', IOPending);

const Alarm = new Schema({
	session: { type: String, ref: 'session' },
	when: Date,
	what: String
});
exports.Alarm = mongoose.model('alarms', Alarm);

const Contact = new Schema({
	id: String,
	first_name: String,
	last_name: String,
	alias: String,
	tags: String,
	session: [{ type: String, ref: 'session' }]
});
Contact.virtual('name').get(function() {
	return this.first_name + ' ' + this.last_name;
});
exports.Contact = mongoose.model('contact', Contact);

const Story = new Schema({
	title: String,
	text: String,
	tags: String,
	url: String,
	date: Date,
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
	session: { type: String, ref: 'session' },
	client: String,
	name: String,
	yearly: String, // set dayofyear, hour and minute
	monthly: String, // set dayofmonth, hour and minute
	weekly: String, // set dayofweek, hour and minute
	daily: String, // set hour and minute
	hourly: String, // set minute
});
exports.Scheduler = mongoose.model('scheduler', Scheduler);

const Knowledge = new Schema({
	input: String,
	output: String,
	session: { type: String, ref: 'session' },
	score: Number
});
exports.Knowledge = mongoose.model('knowledge', Knowledge);
