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

function isChatAvailable(chat, callback) {
	new Memory.TelegramChat()
	.where({ id: chat.id })
	.fetch()
	.then((tc) => {
		if (!tc.get('approved')) {
			return callback('Papà mi ha detto di non parlare con te!!!');
		}
		callback();
	})
	.catch((err) => {
		new Memory.TelegramChat({ 
			id: chat.id,
			title: chat.title,
			first_name: chat.first_name,
			last_name: chat.last_name,
			type: chat.type
		}).save(null, { method: 'insert' });
		callback('Ciao, papà mi ha detto di non parlare con gli sconosciuti! Scusa :(');
	});
}

exports.getChats = function() {
	return new Memory.TelegramChat()
	.where(_.extend({ 
		approved: 1, 
		type: 'private',
	}, 
	config.cron === "debug" ? { debug: 1 } : {}
	)).fetchAll({
		withRelated: ['contact']
	});
};

exports.getChat = function(id) {
	return new Memory.TelegramChat({
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

	if (_config.webhook) {
		bot.setWebHook(_config.webhook.url + _config.token, _config.webhook.options);
		bot.getWebHookInfo().then((e) => {
			console.info(TAG, 'started');
		});
	} else {
		console.info(TAG, 'started');
	}
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
			bot.sendChatAction(data.chatId, 'typing');
			bot.sendMessage(data.chatId, f.speech, message_opt);
			return resolve();
		}

		if (f.data.media) {
			bot.sendChatAction(data.chatId, 'typing');
			if (f.data.media.artist) {
				bot.sendMessage(data.chatId, f.data.media.artist.external_urls.spotify, message_opt);
				return resolve();
			}
			if (f.data.media.track) {
				bot.sendMessage(data.chatId, f.data.media.track.external_urls.spotify, message_opt);
				return resolve();
			}
			if (f.data.media.playlist) {
				bot.sendMessage(data.chatId, f.data.media.playlist.external_urls.spotify, message_opt);
				return resolve();
			}
			return reject();
		}

		if (f.data.image) {
			if (f.data.image.remoteFile) {
				bot.sendChatAction(data.chatId, 'upload_photo');
				bot.sendPhoto(data.chatId, f.data.image.remoteFile, message_opt);
			} else if (f.data.image.localFile) {
				bot.sendChatAction(data.chatId, 'upload_photo');
				bot.sendPhoto(data.chatId, f.data.image.localFile, message_opt);
			}
			return resolve();
		}

		if (f.lyrics) {
			bot.sendChatAction(data.chatId, 'typing');
			bot.sendMessage(data.chatId, f.lyrics.lyrics_body, message_opt);
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

	let data = { 
		chatId: e.chat.id,
		ioId: e.chat.id,
		sessionId: e.chat.id,
		title: e.from.username || e.from.first_name
	};

	if (e.text) {
		log('[' + data.title + '] ' + e.text);
	}

	isChatAvailable(e.chat, (err) => {
		if (err) {
			return exports.emitter.emit('input', {
				data: data,
				params: {
					speech: err
				}
			});
		}

		if (e.text) {
			return exports.emitter.emit('input', {
				data: data,
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
						data: data,
						params: {
							text: text
						}
					});
				})
				.catch((err) => { 
					return exports.emitter.emit('input', {
						data: data,
						error: err
					});
				});
			});
		}

		if (e.photo) {
			return bot.getFileLink( _.last(e.photo).file_id ).then((file_link) => {
				return exports.emitter.emit('input', {
					data: data,
					params: {
						image: {
							remoteFile: file_link,
						}
					}
				});
			});
		}

		return exports.emitter.emit('input', {
			data: data,
			error: {
				unknowInputType: true
			}
		});
	});
});