const Schema = mongoose.Schema;

const Session = new Schema({
	_id: String,
	io_id: String,
	io_data: Schema.Types.Mixed,
	contact: { type: Schema.Types.ObjectId, ref: 'contacts' },
	debug: Boolean,
	approved: Boolean,
	translate_from: String,
	translate_to: String
});
exports.Session = mongoose.model('sessions', Session);

const SessionInput = new Schema({
	session: { type: String, ref: 'sessions' },
	text: String,
});
exports.SessionInput = mongoose.model('session_inputs', SessionInput);

const IOQueue = new Schema({
	session: { type: String, ref: 'sessions' },
	data: Schema.Types.Mixed,
});
exports.IOQueue = mongoose.model('io_queue', IOQueue);

const IOPending = new Schema({
	session: { type: String, ref: 'sessions' },
	action: String,
	data: Schema.Types.Mixed,
});
exports.IOPending = mongoose.model('io_pending', IOPending);

const Alarm = new Schema({
	session: { type: String, ref: 'sessions' },
	when: Date,
	what: String
});
exports.Alarm = mongoose.model('alarms', Alarm);

// Memory

const Contact = new Schema({
	id: String,
	first_name: String,
	last_name: String,
	alias: String,
	tags: String,
	sessions: [{ type: String, ref: 'sessions' }]
});
Contact.virtual('name').get(function() {
	return this.first_name + ' ' + this.last_name;
});
exports.Contact = mongoose.model('contacts', Contact);

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