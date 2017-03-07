const TAG = 'IO.Telegram';
const _config = config.io.telegram;

exports.capabilities = { 
	userCanViewUrls: true
};

const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(_config.token, _config.options);

const SpeechRecognizer = require(__basedir + '/support/speechrecognizer');

let callback;

function log(msg) {
	fs.writeFileSync(__basedir + '/log/' + 'telegram_' + moment().format('YYYY-MM-DD') + '.txt', msg + "\n");
}

function isChatAvailable(chat, callback) {
	new Memory.TelegramChat({ chat_id: chat.id })
	.where({ chat_id: chat.id })
	.fetch()
	.then((tc) => {
		if (!tc.get('approved')) {
			return reject('Papà mi ha detto di non parlare con te!!!');
		}
		callback();
	})
	.catch((err) => {
		new Memory.TelegramChat({ 
			chat_id: chat.id,
			title: chat.title,
			first_name: chat.first_name,
			last_name: chat.last_name,
			type: chat.type
		}).save();
		callback('Ciao, papà mi ha detto di non parlare con gli sconosciuti! Scusa :(');
	});
}

exports.getChats = function() {
	return new Memory.TelegramChat({ approved: 1 }).fetchAll();
};

exports.onInput = function(cb) {
	callback = cb;
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

exports.output = function(data, e) {
	e = e || {};
	if (_.isString(e)) e = { text: e };
	console.ai(TAG, e);

	return new Promise((resolve, reject) => {
		
		if (e.error) {
			if (e.error.noStrategy) {
				// NOOP
			} else if (e.error.text) {		
				bot.sendChatAction(data.chatId, 'typing');
				bot.sendMessage(data.chatId, e.error.text);	
				return resolve();
			} else {
				return resolve();
			}
		}

		if (e.text) {
			bot.sendChatAction(data.chatId, 'typing');
			bot.sendMessage(data.chatId, e.text);
			return resolve();
		}

		if (e.media) {
			bot.sendChatAction(data.chatId, 'typing');
			if (e.media.artist) {
				bot.sendMessage(data.chatId, e.media.artist.external_urls.spotify);
				return resolve();
			}
			if (e.media.track) {
				bot.sendMessage(data.chatId, e.media.track.external_urls.spotify);
				return resolve();
			}
			if (e.media.playlist) {
				bot.sendMessage(data.chatId, e.media.playlist.external_urls.spotify);
				return resolve();
			}
			return reject();
		}

		if (e.photo) {
			if (e.photo.remoteFile) {
				bot.sendChatAction(data.chatId, 'typing');
				bot.sendMessage(data.chatId, e.photo.remoteFile);
			} else if (e.photo.localFile) {
				bot.sendChatAction(data.chatId, 'upload_photo');
				bot.sendPhoto(data.chatId, e.photo.localFile);
			}
			return resolve();
		}

		if (e.lyrics) {
			bot.sendChatAction(data.chatId, 'typing');
			bot.sendMessage(data.chatId, e.lyrics.lyrics_body);
			return resolve();
		}

		return reject();
	});
};

bot.on('message', (e) => {
	console.user(TAG, e);

	let data = { 
		chatId: e.chat.id,
		title: e.from.username || e.from.first_name
	};

	if (e.text) {
		log('[' + data.title + '] ' + e.text);
	}

	isChatAvailable(e.chat, (err) => {
		if (err) {
			return callback(null, data, {
				answer: err
			});
		}

		if (e.text) {
			return callback(null, data, {
				text: e.text
			});
		}

		if (e.voice) {

			return bot.getFileLink(e.voice.file_id).then((file_link) => {
				SpeechRecognizer.recognizeAudioStream( request(file_link) )
				.then((text) => {
					callback(null, data, {
						text: text
					});
				})
				.catch((err) => { callback(err, data);	});
			});

		}

		if (e.photo) {

			return bot.getFileLink( _.last(e.photo).file_id ).then((file_link) => {
				const tmp_file_photo = require('os').tmpdir() + Date.now() + '.jpg';

				request(file_link)
				.pipe(fs.createWriteStream(tmp_file_photo))
				.on('error', (err) => { return callback(err, data); })
				.on('finish', () => {
					callback(null, data, {
						photo: {
							remoteFile: file_link,
							localFile: tmp_file_photo
						}
					});
				});
			});
		}

		return reject();
	});
});