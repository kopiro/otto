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

function isChatAvailable(sender, callback) {
	new Memory.MessengerChat()
	.where({ id: sender.id })
	.fetch({ require: true })
	.then((x) => {
		if (!x.get('approved')) {
			return callback('Papà mi ha detto di non parlare con te!!!');
		}
		callback();
	})
	.catch((err) => {
		bot.getProfile(sender.id, (err, profile) => {
			if (err) return console.error(TAG, err);
			new Memory.MessengerChat({ 
				id: sender.id,
				first_name: profile.first_name,
				last_name: profile.last_name,
				profile_pic: profile.profile_pic,
			}).save(null, { method: 'insert' });
			callback('Ciao, papà mi ha detto di non parlare con gli sconosciuti! Scusa :(');
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

exports.output = function({ data, fulfillment:f }) {
	console.ai(TAG, 'output', data, f);
	f.data = f.data || {};

	return new Promise((resolve, reject) => {
		if (f.error) {
			if (f.error.speech) {		
				bot.sendChatAction(data.chatId, 'typing');
				bot.sendMessage(data.chatId, f.error.speech);	
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
			bot.sendMessage(data.senderId, _.extend(message_opt, {
				text: f.speech
			}), (err, info) => {
				if (err) console.error(TAG, err);
			});
			return resolve();
		}

		if (f.data.media) {
			if (f.data.media.track) {
				bot.sendMessage(data.senderId, _.extend(message_opt, { 
					text: f.data.media.song.external_urls.spotify 
				}), (err, info) => {
					if (err) console.error(TAG, err);
				});
				return resolve();
			}
			return reject();
		}

		if (f.data.image) {
			bot.sendMessage(data.senderId, _.extend(message_opt, { 
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
	console.user(TAG, e);

	let data = {
		sessionId: e.sender.id,
		ioId: e.sender.id,
		senderId: e.sender.id,
		title: e.sender.id
	};

	if (e.message.text) {
		log('[' + data.title + '] ' + e.message.text);
	}

	isChatAvailable(e.sender, (err) => {
		if (err) {
			return exports.emitter.emit('input', {
				data: data,
				params: {
					fulfillment: {
						speech: err
					}
				}
			});
		}

		if (e.message.text) {
			return exports.emitter.emit('input', {
				data: data,
				params: {
					text: e.message.text
				}
			});
		}

		if (e.message.attachments) {
			const attach = _.first(e.message.attachments);
			if (attach.type === 'image') {
				return exports.emitter.emit('input', {
					data: data,
					params: {
						image: {
							remoteFile: attach.payload.url,
						}
					}
				});
			}
		}

		return exports.emitter.emit('input', {
			data: data,
			error: {
				unkownInputType: true
			}
		});
	});

});