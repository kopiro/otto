const TelegramBot = require('node-telegram-bot-api');
const _config = config.io.telegram;

const bot = new TelegramBot(_config.token, _config.options);

if (_config.webhook) {
	var listenUrl = _config.webhook.url + _config.token;
	bot.setWebHook(listenUrl, _config.webhook.options);
	bot.getWebHookInfo().then(function(e){
		console.info('IO.Telegram', 'Webhook status', e); 
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

	console.info('IO.Telegram', 'started');

	bot.on('message', (e) => {
		console.info('IO.Telegram', 'message', JSON.stringify(e));
		callback({
			sessionId: e.chat.id,
			text: e.text
		});
	});
};

exports.output = function({sessionId, text}) {
	bot.sendMessage(sessionId, text);
};