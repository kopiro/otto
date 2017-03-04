const TAG = 'IO.Telegram';
const _config = config.io.telegram;

exports.capabilities = { 
	userCanViewUrls: true
};

const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(_config.token, _config.options);

const SpeechRecognizer = require(__basedir + '/support/speechrecognizer');

let callback;

function isChatAvailable(chat) {
	return new Promise((resolve, reject) => {
		new Memory.TelegramChat({ chat_id: chat.id })
		.fetch({ required: true })
		.then((tc) => {
			if (!tc.get('approved')) {
				return reject('Papà mi ha detto di non parlare con te!!!');
			}
			resolve();
		})
		.catch((err) => {
			new Memory.TelegramChat({ 
				chat_id: chat.id,
				title: chat.title,
				first_name: chat.first_name,
				last_name: chat.last_name,
				type: chat.type
			}).save();
			reject('Ciao, papà mi ha detto di non parlare con gli sconosciuti! Scusa :(');
		});
	});
}

exports.getChats = function() {
	new Memory.TelegramChat({ approved: 1 }).fetchAll();
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
	}
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

bot.on('message', (e) => {
	console.user(TAG, e);

	let data = { chatId: e.chat.id };

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