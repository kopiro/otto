const TAG = 'IO.Telegram';
const _config = config.io.telegram;

const EventEmitter = require('events').EventEmitter;
exports.emitter = new EventEmitter();

exports.id = 'telegram';

const TelegramBot = require('node-telegram-bot-api');
const SpeechRecognizer = apprequire('speechrecognizer');
const Polly = apprequire('polly');
const Play = apprequire('play');

const bot = new TelegramBot(_config.token, _config.options);

const STICKERS = {
	me: 'CAADBAADRQMAAokSaQP3vsj1u7oQ9wI',
	logo: 'CAADBAADRAMAAokSaQMXx8V8QvEybAI'
};

const WRITE_KEY_SPEED = (_config.writeKeySpeed ? _config.writeKeySpeed : 1);

function sendMessage(chat_id, text, telegram_opt) {
	return new Promise((resolve, reject) => {
		async.eachSeries(Util.mimicHumanMessage(text), (t, next) => {
			bot.sendChatAction(chat_id, 'typing');

			setTimeout(() => {
				bot.sendMessage(chat_id, t, telegram_opt)
				.then(next);
			}, Math.max(2000, WRITE_KEY_SPEED * t.length));
		}, resolve);
	});
}

function sendVoiceMessage(chat_id, text, polly_opt, telegram_opt) {
	return new Promise((resolve, reject) => {
		async.eachSeries(Util.mimicHumanMessage(text), (t, next) => {
			bot.sendChatAction(chat_id, 'record_audio');

			Polly.getAudioFile(t, polly_opt)
			.then((polly_file) => {
				Play.fileToTmpFile(polly_file, (err, audio_tmp_file) => {
					if (err) return reject();

					bot.sendVoice(chat_id, audio_tmp_file, telegram_opt)
					.then(next);
				});
			})
			.catch(reject);
		}, resolve);
	});
}


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
	console.info(TAG, 'output', session_model._id, f);
	
	return new Promise((resolve, reject) => {
		const language = f.data.language || session_model.translate_to || config.language;
		const chat_id = session_model.io_data.id;

		if (f.data.error) {
			if (f.data.error.speech) {		
				return sendMessage(chat_id, f.data.error.speech)
				.then(resolve)
				.catch(reject);	
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

			if (session_model.getPipe().nextOutputWithVoice) {
				session_model.saveInPipe({ nextOutputWithVoice: false });

				console.debug(TAG, 'using voice output');

				return sendVoiceMessage(chat_id, f.speech, {
					language: language
				}, message_opt)
				.then(() => {
					if (f.data.url) {
						bot.sendMessage(chat_id, f.data.url, message_opt)
						.then(resolve)
						.catch(reject);
					} else {
						resolve();
					}
				})
				.catch(reject);

			} else {
				return sendMessage(chat_id, f.speech, message_opt)
				.then(() => {
					if (f.data.url) {
						bot.sendMessage(chat_id, f.data.url, message_opt)
						.then(resolve)
						.catch(reject);
					} else {
						resolve();
					}
				})
				.catch(reject);
			}

		}

		if (f.data.game) {
			callback_queries[chat_id] = callback_queries[chat_id] || {};
			callback_queries[chat_id][f.data.game.id] = f.data.game;
			bot.sendGame(chat_id, f.data.game.id);
		}

		if (f.data.media) {
			if (f.data.media.artist) {
				return sendMessage(chat_id, f.data.media.artist.external_urls.spotify, message_opt)
				.then(resolve)
				.catch(reject);
			}
			if (f.data.media.track) {
				return sendMessage(chat_id, f.data.media.track.external_urls.spotify, message_opt)
				.then(resolve)
				.catch(reject);
			}
			if (f.data.media.playlist) {
				return sendMessage(chat_id, f.data.media.playlist.external_urls.spotify, message_opt)
				.then(resolve)
				.catch(reject);
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
			return sendMessage(chat_id, f.lyrics.lyrics_body, message_opt)
			.then(resolve)
			.catch(reject);
		}

		return reject({ unknownOutputType: true });
	});
};

function handleVoice(session_model, e) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, 'user sent a voice message, downloading file');
		
		bot.getFileLink(e.voice.file_id)
		.then((file_link) => {

			var voice_file = __tmpdir + '/' + require('uuid').v4() + '.ogg';
			console.debug(TAG, 'downloading voice message file <' + file_link + '> to <' + voice_file + '>');

			request(file_link).on('response',  (res) => {
				const r2 = fs.createWriteStream(voice_file);
				r2.on('finish', () => {
					
					console.debug(TAG, 'converting OGG file to FLAC');

					spawn('opusdec', [ 
					voice_file, voice_file + '.wav',
					'--rate', 16000
					])
					.on('close', (err) => {
						if (err) {
							console.error(TAG, 'error during conversion');
							return reject(err);
						}

						console.debug(TAG, 'file converted, sending to SR');

						SpeechRecognizer.recognizeAudioStream(fs.createReadStream(voice_file + '.wav'), {
							language: (session_model.translate_from || config.language)
						})
						.then(resolve)
						.catch(reject);
					});
				});
				res.pipe(r2);
			});
		})
		.catch((err) => {
			console.debug(TAG, 'error in getFileLink', err);
			reject(err);
		});
	});
}

/////////////////
// Init events //
/////////////////

bot.on('webhook_error', (err) => {
	console.error(TAG, 'webhook error', err);
});

bot.on('message', (e) => {
	console.info(TAG, 'input', e);

	let sessionId = e.chat.id;

	IOManager.registerSession(sessionId, exports.id, e.chat, e.text)
	.then((session_model) => {

		const chat_is_group = (session_model.io_data.type != 'private');

		if (e.text) {
			// If we are in a group, only listen for activators
			if (chat_is_group && false === AI_NAME_ACTIVATOR.test(e.text)) {
				console.debug(TAG, 'skipping input for missing activator', e.text);
				return;
			}

			return exports.emitter.emit('input', {
				session_model: session_model,
				params: {
					text: e.text
				}
			});
		}

		if (e.voice) {
			return handleVoice(session_model, e)
			.then((text) => {
				// If we are in a group, only listen for activators
				if (chat_is_group && false === AI_NAME_ACTIVATOR.test(e.text)) {
					console.debug(TAG, 'skipping input for missing activator', e.text);
					return;
				}

				// User sent a voice note, respond with a voice note :)
				session_model.saveInPipe({ nextOutputWithVoice: true });
				
				exports.emitter.emit('input', {
					session_model: session_model,
					params: {
						text: text
					}
				});
			})
			.catch((err) => {
				if (chat_is_group) return;

				if (err.unrecognized) {
					return exports.emitter.emit('input', {
						session_model: session_model,
						error: {
							speech: ERRMSG_SR_UNRECOGNIZED
						}
					});
				}

				exports.emitter.emit('input', {
					session_model: session_model,
					error: {
						speech: ERRMSG_SR_GENERIC
					}
				});
			});
		}

		if (e.photo) {
			return bot.getFileLink( _.last(e.photo).file_id ).then((file_link) => {
				if (chat_is_group) return;
				exports.emitter.emit('input', {
					session_model: session_model,
					params: {
						image: {
							remoteFile: file_link,
						}
					}
				});
			});
		}

		if (!chat_is_group) {
			return exports.emitter.emit('input', {
				session_model: session_model,
				error: {
					unknowInputType: true
				}
			});
		}
	})
	.catch((session_model) => {
		if (!chat_is_group)  {
			exports.emitter.emit('input', {
				session_model: session_model,
				error: {
					unauthorized: true
				}
			});
		}
	});
});

const callback_queries = {};

bot.on("callback_query", (e) => {
	if (e.game_short_name) {
		const user = callback_queries[e.from.id];
		if (user) {
			if (user[e.game_short_name]) {
				bot.answerCallbackQuery(e.id, undefined, false, user[e.game_short_name]);
			}
		}
	}
});