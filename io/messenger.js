const TAG = 'IO.Messenger';
const _config = config.io.messenger;

const EventEmitter = require('events').EventEmitter;
exports.emitter = new EventEmitter();

exports.id = 'messenger';
exports.capabilities = { 
	userCanViewUrls: true
};

const messengerbot = require('messenger-bot');
const bot = new messengerbot(_config);

const SpeechRecognizer = apprequire('speechrecognizer');

function log(msg) {
	fs.writeFileSync(__basedir + '/log/' + 'messenger_' + moment().format('YYYY-MM-DD') + '.txt', msg + "\n");
}

function registerSession(sessionId, data) {
	return new Promise((resolve, reject) => {
		new Memory.Session({ id: sessionId })
		.fetch({ require: true })
		.then((session_model) => {
			if (!session_model.get('approved')) return reject(session_model);
			resolve(session_model);
		})
		.catch((err) => {
			bot.getProfile(data.id, (err, profile) => {
				let session_model = new Memory.Session({ 
					id: sessionId,
					io_id: exports.id,
					io_data: JSON.stringify(data),
					first_name: profile.first_name,
					last_name: profile.last_name,
				}).save(null, { method: 'insert' });
				reject(session_model);
			});
		});
	});
}

exports.getChats = function() {
	return new Memory.MessengerChat()
	.where(_.extend({ 
		approved: 1, 
	}, 
	config.cron === "debug" ? { debug: 1 } : {}
	)).fetchAll();
};

exports.getChat = function(id) {
	return new Memory.MessengerChat({
		id: id
	}).fetch({
		withRelated: ['contact']
	});
};

exports.getAlarmsAt = function(when) {
	return new Memory.Alarm()
	.where(_.extend({ 
		io: exports.id,
		when: when,
		notified: 0
	}, 
	config.cron === "debug" ? { debug: 1 } : {}
	)).fetchAll();
};

exports.startInput = function() {
	if (exports.startInput.started) return;
	exports.startInput.started = true;

	require('http').createServer( bot.middleware() ).listen(_config.port);
	console.info(TAG, 'started on port ' + _config.port);
};

exports.output = function(f, session_model) {
	console.ai(TAG, 'output', session_model.id, f);

	return new Promise((resolve, reject) => {
		if (f.error) {
			if (f.error.speech) {		
				bot.sendChatAction(session_model.getIOData().id, 'typing');
				bot.sendMessage(session_model.getIOData().id, f.error.speech);	
				return resolve();
			} else {
				return resolve();
			}
		}

		let message_opt = {};

		if (f.data.replies) {
			message_opt = {
				quick_replies: f.data.replies.map((r) => {
					if (_.isString(r)) r = { id: r, text: r };
					return {
						title: r.text,
						payload: r.id,
						content_type: 'text',
					};
				})
			};
		}

		if (f.speech) {
			if (f.data.url) {
				f.speech += "\n" + f.data.url;
			}
			bot.sendMessage(session_model.getIOData().id, _.extend(message_opt, {
				text: f.speech
			}), (err, info) => {
				if (err) console.error(TAG, err);
			});
			return resolve();
		}

		if (f.data.media) {
			if (f.data.media.track) {
				bot.sendMessage(session_model.getIOData().id, _.extend(message_opt, { 
					text: f.data.media.song.external_urls.spotify 
				}), (err, info) => {
					if (err) console.error(TAG, err);
				});
				return resolve();
			}
			return reject();
		}

		if (f.data.image) {
			bot.sendMessage(session_model.getIOData().id, _.extend(message_opt, { 
				attachment: {
					type: 'image',
					payload: {
						url: image.remoteFile,
						is_reusable: true
					}
				}
			}), (err, info) => {
				if (err) console.error(TAG, err);
			});
			return resolve();
		}

		if (f.data.lyrics) {
			bot.sendMessage(data.recipientId, _.extend(message_opt, { 
				text: params.lyrics.lyrics_body
			}), (err, info) => {
				if (err) console.error(TAG, err);
			});
			return resolve();
		}

		return reject();
	});
};

bot.on('error', (err) => {
	console.error(TAG, err);
});

bot.on('message', (e) => {
	console.user(TAG, 'input', e);

	let sessionId = e.sender.id;

	registerSession(sessionId, e.sender)
	.then((session_model) => {
		if (e.message.text) {
			return exports.emitter.emit('input', {
				session_model: session_model,
				params: {
					text: e.message.text
				}
			});
		}

		if (e.message.attachments) {
			const attach = _.first(e.message.attachments);
			if (attach.type === 'image') {
				return exports.emitter.emit('input', {
					session_model: session_model,
					params: {
						image: {
							remoteFile: attach.payload.url,
						}
					}
				});
			}
		}

		return exports.emitter.emit('input', {
			session_model: session_model,
			error: {
				unkownInputType: true
			}
		});
	})
	.catch((session_model) => {
		exports.emitter.emit('input', {
			session_model: session_model,
			error: {
				unauthorized: true
			}
		});
	});

});