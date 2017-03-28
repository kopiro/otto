const TAG = 'IO.Telegram';
const _config = config.io.telegram;

const EventEmitter = require('events').EventEmitter;
exports.emitter = new EventEmitter();

exports.id = 'telegram';
exports.capabilities = { 
	userCanViewUrls: true
};

const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(_config.token, _config.options);

const SpeechRecognizer = apprequire('speechrecognizer');

function log(msg) {
	fs.writeFileSync(__basedir + '/log/' + 'telegram_' + moment().format('YYYY-MM-DD') + '.txt', msg + "\n");
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
			let session_model = new Memory.Session({ 
				id: sessionId,
				io_id: exports.id,
				io_data: JSON.stringify(data),
				title: data.title,
				first_name: data.first_name,
				last_name: data.last_name,
				type: data.type
			}).save(null, { method: 'insert' });
			reject(session_model);
		});
	});
}

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

	if (_config.webhook) {
		bot.setWebHook(_config.webhook.url + _config.token, _config.webhook.options);
		bot.getWebHookInfo().then((e) => {
			console.info(TAG, 'started');
		});
	} else {
		console.info(TAG, 'started');
	}
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

		if (f.data.replies != null) {
			message_opt = {
				reply_markup: {
					resize_keyboard: true,
					one_time_keyboard: true,
					keyboard: [ 
					f.data.replies.map((r) => { return r.text; }) 
					]
				}
			};
		}
		
		if (f.speech) {
			if (f.data.url) {
				f.speech += "\n" + f.data.url;
			}
			bot.sendChatAction(session_model.getIOData().id, 'typing');
			bot.sendMessage(session_model.getIOData().id, f.speech, message_opt);
			return resolve();
		}

		if (f.data.media) {
			bot.sendChatAction(session_model.getIOData().id, 'typing');
			if (f.data.media.artist) {
				bot.sendMessage(session_model.getIOData().id, f.data.media.artist.external_urls.spotify, message_opt);
				return resolve();
			}
			if (f.data.media.track) {
				bot.sendMessage(session_model.getIOData().id, f.data.media.track.external_urls.spotify, message_opt);
				return resolve();
			}
			if (f.data.media.playlist) {
				bot.sendMessage(session_model.getIOData().id, f.data.media.playlist.external_urls.spotify, message_opt);
				return resolve();
			}
			return reject();
		}

		if (f.data.image) {
			if (f.data.image.remoteFile) {
				bot.sendChatAction(session_model.getIOData().id, 'upload_photo');
				bot.sendPhoto(session_model.getIOData().id, f.data.image.remoteFile, message_opt);
			} else if (f.data.image.localFile) {
				bot.sendChatAction(session_model.getIOData().id, 'upload_photo');
				bot.sendPhoto(session_model.getIOData().id, f.data.image.localFile, message_opt);
			}
			return resolve();
		}

		if (f.lyrics) {
			bot.sendChatAction(session_model.getIOData().id, 'typing');
			bot.sendMessage(session_model.getIOData().id, f.lyrics.lyrics_body, message_opt);
			return resolve();
		}

		return reject({ unknownOutputType: true });
	});
};

/////////////////
// Init events //
/////////////////

bot.on('webhook_error', (err) => {
  console.error(TAG, 'webhook error', err);
});

bot.on('message', (e) => {
	console.user(TAG, 'input', e);

	let sessionId = 'telegram-' + e.chat.id;

	registerSession(sessionId, e.chat)
	.then((session_model) => {
		if (e.text) {
			return exports.emitter.emit('input', {
				session_model: session_model,
				params: {
					text: e.text
				}
			});
		}

		if (e.voice) {
			return bot.getFileLink(e.voice.file_id).then((file_link) => {
				SpeechRecognizer.recognizeAudioStream( request(file_link) )
				.then((text) => {
					return exports.emitter.emit('input', {
						session_model: session_model,
						params: {
							text: text
						}
					});
				})
				.catch((err) => { 
					return exports.emitter.emit('input', {
						session_model: session_model,
						error: err
					});
				});
			});
		}

		if (e.photo) {
			return bot.getFileLink( _.last(e.photo).file_id ).then((file_link) => {
				return exports.emitter.emit('input', {
					session_model: session_model,
					params: {
						image: {
							remoteFile: file_link,
						}
					}
				});
			});
		}

		return exports.emitter.emit('input', {
			session_model: session_model,
			error: {
				unknowInputType: true
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