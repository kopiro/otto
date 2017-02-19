const TAG = 'IO.Telegram';

exports.capabilities = { 
	user_can_view_urls: true
};

const TelegramBot = require('node-telegram-bot-api');
const _config = config.io.telegram;

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

exports.onInput = function(cb) {
	callback = cb;
};

exports.startInput = function() {
	if (started) return;
	started = true;

	console.info(TAG, 'started');

	bot.on('message', (e) => {
		console.info(TAG, 'message', JSON.stringify(e));

		if (e.text) {
			callback({
				sessionId: e.chat.id,
				text: e.text
			});
		} else if (e.voice) {
			const tmp_file_audio = require('os').tmpdir() + Date.now() + '.flac';

			const speechRecognizer = new SpeechRecognizer({
				sampleRate: 16000,
				encoding: 'FLAC'
			}, (sr_results) => {
				sr_results.sessionId = e.chat.id;
				callback(sr_results);
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
		if (e.text) {
			bot.sendMessage(e.sessionId, e.text);
		} else if (e.spotify) {
			bot.sendMessage(e.sessionId, e.spotify.external_urls.spotify);
		}
		resolve();
	});
};