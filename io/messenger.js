const TAG = 'IO.Messenger';
const _config = config.io.messenger;

exports.capabilities = { 
	userCanViewUrls: true
};

const MessengerBot = require('messenger-bot');
const bot = new MessengerBot(_config);

const SpeechRecognizer = require(__basedir + '/support/speechrecognizer');

let callback;

function isChatAvailable(sender, callback) {
	new Memory.MessengerChat()
	.where({ sender_id: sender.id })
	.fetch({ require: true })
	.then((x) => {
		if (!x.get('approved')) {
			return reject('Papà mi ha detto di non parlare con te!!!');
		}
		callback();
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
			callback('Ciao, papà mi ha detto di non parlare con gli sconosciuti! Scusa :(');
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
		console.ai(TAG, data,e);
		if (_.isString(e)) e = { text: e };

		if (e.error) return resolve();

		if (e.text) {
			bot.sendMessage(data.senderId, { text: e.text }, (err) => {
				if (err) console.error(TAG, err);
			});
			return resolve();
		}

		if (e.spotify) {
			if (e.spotify.song) {
				bot.sendMessage(data.senderId, { text: e.spotify.song.external_urls.spotify }, (err) => {
					if (err) console.error(TAG, err);
				});
				return resolve();
			}
			return reject();
		}

		if (e.photo) {
			bot.sendMessage(data.recipientId, { 
				attachment: {
					type: 'image',
					payload: {
						url: photo.remoteFile,
						is_reusable: true
					}
				}
			}, (err) => {
				if (err) console.error(TAG, err);
			});
			return resolve();
		}

		if (e.lyrics) {
			bot.sendMessage(data.recipientId, { text: e.lyrics.lyrics_body  }, (err) => {
				if (err) console.error(TAG, err);
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

	let data = { 
		senderId: e.sender.id, 
	};

	isChatAvailable(e.sender, (err) => {
		if (err) {
			return callback(null, data, {
				answer: err
			});
		}

		if (e.message.text) {
			return callback(null, data, {
				text: e.message.text
			});
		}
	});

});