const TAG = 'IO.Messenger';
const _config = config.io.messenger;

exports.capabilities = { 
	userCanViewUrls: true
};

const MessengerBot = require('messenger-bot');
const bot = new MessengerBot(_config);

const SpeechRecognizer = require(__basedir + '/support/speechrecognizer');

let callback;

function isChatAvailable(sender) {
	return new Promise((resolve, reject) => {
		new Memory.MessengerChat({ sender_id: sender.id })
		.fetch({ required: true })
		.then((tc) => {
			if (!tc.get('approved')) {
				return reject('Papà mi ha detto di non parlare con te!!!');
			}
			resolve();
		})
		.catch((err) => {
			bot.getProfile(sender.id, (err, profile) => {
				if (err) return console.error(TAG, err);
				new Memory.MessengerChat({ 
					sender_id: sender.id,
					first_name: profile.first_name,
					last_name: profile.last_name,
					profile_pic: profile.profile_pic,
				}).save();
				reject('Ciao, papà mi ha detto di non parlare con gli sconosciuti! Scusa :(');
			});
		});
	});
}

exports.getConversations = function() {
	new Memory.MessengerChat({ approved: 1 }).fetchAll();
};

exports.onInput = function(cb) {
	callback = cb;
};

exports.startInput = function() {
	if (exports.startInput.started) return;
	exports.startInput.started = true;

	require('http').createServer( bot.middleware() ).listen(_config.port);
	console.info(TAG, 'started on port ' + _config.port);
};

exports.output = function(data, e) {
	return new Promise((resolve, reject) => {
		console.ai(TAG, e);
		if (_.isString(e)) e = { text: e };

		if (e.error) return resolve();

		if (e.text) {
			bot.sendSenderAction(data.senderId, 'typing_on');
			bot.sendMessage(data.senderId, { text: e.text });
			return resolve();
		}

		if (e.spotify) {
			if (e.spotify.song) {
				bot.sendSenderAction(data.senderId, 'typing_on');
				bot.sendMessage(data.senderId, { text: e.spotify.song.external_urls.spotify });
				return resolve();
			}
			return reject();
		}

		if (e.photo) {
			bot.sendSenderAction(data.senderId, 'typing_on');
			bot.sendMessage(data.senderId, { 
				attachment: {
					type: 'image',
				}
			});
			return resolve();
		}

		return reject();
	});
};

bot.on('error', (err) => {
	console.error(TAG, err);
});

bot.on('message', (e) => {
	console.user(TAG, e);

	let data = { senderId: e.sender.id };

	isChatAvailable(e.sender)
	.then(() => {

		if (e.text) {
			return callback(null, data, {
				text: e.message.text
			});
		}

	})
	.catch((err) => {
		callback(null, data, {
			answer: err
		});
	});

});