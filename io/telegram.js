const TAG = 'IO.Telegram';
const _config = config.io.telegram;

exports.capabilities = { 
	userCanViewUrls: true
};

const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(_config.token, _config.options);
if (_config.webhook) {
	var listenUrl = _config.webhook.url + _config.token;
	bot.setWebHook(listenUrl, _config.webhook.options);
	bot.getWebHookInfo().then((e) => {
		console.info(TAG, 'started', e); 
	});
}

const SpeechRecognizer = require(__basedir + '/support/speechrecognizer');

let callback;

function isChatAvailable(chat) {
	return new Promise((resolve, reject) => {
		new Memory.TelegramChat({ id: chat.id })
		.fetch({ required: true })
		.then((tc) => {
			if (!tc.get('approved')) {
				return reject('Papà mi ha detto di non parlare con te!!!');
			}
			resolve();
		})
		.catch((err) => {
			new Memory.TelegramChat({ 
				id: chat.id,
				title: chat.title || chat.first_name,
				type: chat.type
			}).save();
			reject('Ciao, papà mi ha detto di non parlare con gli sconosciuti! Scusa :(');
		});
	});
}

exports.getConversations = function() {
	return new Promise((resolve, reject) => {
		DB.query('SELECT * FROM telegram_chats WHERE approved = 1', (err, results) => {
			if (err) return reject(err);
			resolve(results);
		});
	});
};

exports.onInput = function(cb) {
	callback = cb;
};

exports.startInput = function() {
	// singleton event
	if (exports.startInput.started) return;
	exports.startInput.started = true;

	bot.on('message', (e) => {
		console.user(TAG, e);

		let data = { chatId: e.chat.id };

		// Store the chat in the database for future contacts
		isChatAvailable(e.chat)
		.then(() => {

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

		})
		.catch((err) => {
			callback(null, data, {
				answer: err
			});
		});
	});
};

exports.output = function(data, e) {
	return new Promise((resolve, reject) => {
		console.ai(TAG, e);
		if (_.isString(e)) e = { text: e };

		if (e.error) return resolve();

		if (e.text) {
			bot.sendChatAction(data.chatId, 'typing');
			bot.sendMessage(data.chatId, e.text);
			return resolve();
		}

		if (e.spotify) {
			bot.sendChatAction(data.chatId, 'typing');
			if (e.spotify.song) {
				bot.sendMessage(data.chatId, e.spotify.song.external_urls.spotify);
				return resolve();
			}
			return reject();
		}

		if (e.photo) {
			bot.sendChatAction(data.chatId, 'upload_photo');
			bot.sendPhoto(data.chatId, e.photo);
			return resolve();
		}

		return reject();
	});
};