const TAG = 'IO.Telegram';
const _config = config.io.telegram;

exports.capabilities = { 
	user_can_view_urls: true
};

const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(_config.token, _config.options);

if (_config.webhook) {
	var listenUrl = _config.webhook.url + _config.token;
	bot.setWebHook(listenUrl, _config.webhook.options);
	bot.getWebHookInfo().then(function(e){
		console.info('IO.Telegram', 'webhook status', e); 
	});
}

let callback;
let started = false;

exports.getConversations = function() {
	return new Promise((resolve, reject) => {
		DB.query('SELECT * FROM telegram_chats', (err, results) => {
			if (err) return reject(err);
			resolve(results);
		});
	});
};

exports.onInput = function(cb) {
	callback = cb;
};

exports.startInput = function() {
	if (started) return;
	started = true;

	console.info(TAG, 'started');

	bot.on('message', (e) => {
		console.info(TAG, 'message', JSON.stringify(e));
		let data = { chatId: e.chat.id };

		// Store chats in database
		DB.query('SELECT * FROM telegram_chats WHERE id = ?', [ e.chat.id ], function(err, data) {
			if (err || data.length === 0) {
				DB.query('INSERT INTO telegram_chats SET ? ', {
					id: e.chat.id, 
					title: e.chat.title || e.chat.username,
					type: e.chat.type
				});
			}
		});

		if (e.text) {
			callback({
				data: data,
				text: e.text
			});
		} else if (e.voice) {
			const tmp_file_audio = require('os').tmpdir() + Date.now() + '.flac';

			const speechRecognizer = new SpeechRecognizer({
				sampleRate: 16000,
				encoding: 'FLAC'
			}, (e) => {
				e.data = data;
				callback(e);
			}, () => {
				fs.unlink(tmp_file_audio);
			});
			
			bot.getFileLink(e.voice.file_id).then((file) => {
				require('fluent-ffmpeg')(require('request')(file))
				.output(tmp_file_audio)
				.outputOptions(['-ac 1', '-ar 16000'])
				.on('end', () => {
					fs.createReadStream(tmp_file_audio)
					.pipe(speechRecognizer);
				})
				.run();
			});
		}
	});
};

exports.output = function(e) {
	console.ai(TAG, 'output', e);
	
	return new Promise((resolve, reject) => {
		bot.sendChatAction(e.data.chatId, 'typing');

		setTimeout(() => {
			if (e.text) {
				bot.sendMessage(e.data.chatId, e.text);
			} else if (e.spotify) {
				bot.sendMessage(e.data.chatId, e.spotify.external_urls.spotify);
			} else if (e.image) {
				bot.sendPhoto(e.data.chatId, e.image);
			}
			resolve();
		}, 500);
	});
};