const TAG = 'IO.Telegram';
const _config = config.io.telegram;

const EventEmitter = require('events').EventEmitter;
exports.emitter = new EventEmitter();

exports.id = 'telegram';
exports.capabilities = { 
	userCanViewUrls: true
};

const TelegramBot = require('node-telegram-bot-api');
const SpeechRecognizer = apprequire('speechrecognizer');

const bot = new TelegramBot(_config.token, _config.options);

const STICKERS = {
	me: 'CAADBAADRQMAAokSaQP3vsj1u7oQ9wI',
	logo: 'CAADBAADRAMAAokSaQMXx8V8QvEybAI'
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
	console.info(TAG, 'output', session_model.id, f);
	
	return new Promise((resolve, reject) => {

		const chat_id = session_model.getIOData().id;

		if (f.data.error) {
			if (f.data.error.speech) {		
				bot.sendChatAction(chat_id, 'typing');
				bot.sendMessage(chat_id, f.data.error.speech);	
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
					f.data.replies.map((r) => { 
						if (_.isObject(r)) return r.text; 
						if (_.isString(r)) return r;
					}) 
					]
				}
			};
		}
		
		if (f.speech) {
			if (f.data.url) {
				f.speech += "\n" + f.data.url;
			}
			bot.sendChatAction(chat_id, 'typing');
			bot.sendMessage(chat_id, f.speech, message_opt);
			return resolve();
		}

		if (f.data.game) {
			callback_queries[chat_id] = callback_queries[chat_id] || {};
			callback_queries[chat_id][f.data.game.id] = f.data.game;
			bot.sendGame(chat_id, f.data.game.id);
		}

		if (f.data.media) {
			bot.sendChatAction(chat_id, 'typing');
			if (f.data.media.artist) {
				bot.sendMessage(chat_id, f.data.media.artist.external_urls.spotify, message_opt);
				return resolve();
			}
			if (f.data.media.track) {
				bot.sendMessage(chat_id, f.data.media.track.external_urls.spotify, message_opt);
				return resolve();
			}
			if (f.data.media.playlist) {
				bot.sendMessage(chat_id, f.data.media.playlist.external_urls.spotify, message_opt);
				return resolve();
			}
			return reject();
		}

		if (f.data.video) {
			if (f.data.video.remoteFile) {
				bot.sendChatAction(chat_id, 'upload_video');
				bot.sendVideo(chat_id, f.data.video.remoteFile, message_opt);
			} else if (f.data.video.localFile) {
				bot.sendChatAction(chat_id, 'upload_video');
				bot.sendVideo(chat_id, f.data.video.localFile, message_opt);
			}
			return resolve();
		}

		if (f.data.image) {
			if (f.data.image.remoteFile) {
				bot.sendChatAction(chat_id, 'upload_photo');
				bot.sendPhoto(chat_id, f.data.image.remoteFile, message_opt);
			} else if (f.data.image.localFile) {
				bot.sendChatAction(chat_id, 'upload_photo');
				bot.sendPhoto(chat_id, f.data.image.localFile, message_opt);
			}
			return resolve();
		}

		if (f.lyrics) {
			bot.sendChatAction(chat_id, 'typing');
			bot.sendMessage(chat_id, f.lyrics.lyrics_body, message_opt);
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
	console.info(TAG, 'input', e);

	let sessionId = e.chat.id;

	IOManager.registerSession(sessionId, exports.id, e.chat, {
		first_name: e.chat.first_name,
		last_name: e.chat.last_name,
		type: e.chat.type
	}, e.text)
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
				SpeechRecognizer.recognizeAudioStream(request(file_link), {
					must_convert: true,
					language: session_model.get('translate_from')
				})
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
						error: {
							speech: "Scusami, ma non ho capito quello che hai detto!"
						}
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
		console.log(session_model);
		exports.emitter.emit('input', {
			session_model: session_model,
			error: {
				unauthorized: true
			}
		});
	});
});

const callback_queries = {};

bot.on("callback_query", (e) => {
	if (e.game_short_name) {
		const user = callback_queries[e.from.id];
		if (user) {
			if (user[e.game_short_name]) {
				bot.answerCallbackQuery(e.id, undefined, false, user[e.game_short_name]);
				delete user[e.game_short_name];
			}
		}
	}
});