const TAG = 'IO.Messenger';
const _config = config.io.messenger;

const EventEmitter = require('events').EventEmitter;
exports.emitter = new EventEmitter();

exports.id = path.basename(__filename, '.js');
exports.capabilities = { 
	userCanViewUrls: true
};

const MessengerBot = require('messenger-bot');
const bot = new MessengerBot(_config);

const SpeechRecognizer = require(__basedir + '/support/speechrecognizer');

function isChatAvailable(sender, callback) {
	new Memory.MessengerChat()
	.where({ sender_id: sender.id })
	.fetch()
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

exports.getChats = function() {
	return new Memory.MessengerChat()
	.where(_.extend({ 
		approved: 1, 
		type: 'private',
	}, 
	config.cron === "debug" ? { debug: 1 } : {}
	)).fetchAll();
};

exports.startInput = function() {
	if (exports.startInput.started) return;
	exports.startInput.started = true;

	require('http').createServer( bot.middleware() ).listen(_config.port);
	console.info(TAG, 'started on port ' + _config.port);
};

exports.output = function({ data, params }) {
	console.ai(TAG, params);

	return new Promise((resolve, reject) => {
		if (params.error) {
			if (params.error.noStrategy) {
				// NOOP
			} else if (params.error.text) {		
				bot.sendMessage(data.senderId, { text: params.text });	
				return resolve();
			} else {
				return resolve();
			}
		}

		if (e.text) {
			bot.sendMessage(data.senderId, { text: params.text });
			return resolve();
		}

		if (params.spotify) {
			if (params.spotify.song) {
				bot.sendMessage(data.senderId, { text: params.spotify.song.external_urls.spotify });
				return resolve();
			}
			return reject();
		}

		if (params.photo) {
			bot.sendMessage(data.recipientId, { 
				attachment: {
					type: 'image',
					payload: {
						url: photo.remoteFile,
						is_reusable: true
					}
				}
			});
			return resolve();
		}

		if (params.lyrics) {
			bot.sendMessage(data.recipientId, { text: params.lyrics.lyrics_body  });
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
			exports.emitter.emit('input', {
				data: data,
				error: err
			});
		}

		if (e.message.text) {
			exports.emitter.emit('input', {
				data: data,
				params: {
					text: e.message.text
				}
			});
		}

		exports.emitter.emit('input', {
			data: data,
			error: {
				unkownInputType: true
			}
		});
	});

});