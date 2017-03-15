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

function log(msg) {
	fs.writeFileSync(__basedir + '/log/' + 'messenger_' + moment().format('YYYY-MM-DD') + '.txt', msg + "\n");
}

function isChatAvailable(sender, callback) {
	new Memory.MessengerChat()
	.where({ id: sender.id })
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
				id: sender.id,
				first_name: profile.first_name,
				last_name: profile.last_name,
				profile_pic: profile.profile_pic,
			}).save(null, { method: 'insert' });
			callback('Ciao, papà mi ha detto di non parlare con gli sconosciuti! Scusa :(');
		});
	});
}

exports.getChats = function() {
	return new Memory.MessengerChat()
	.where(_.extend({ 
		approved: 1, 
	}, 
	config.cron === "debug" ? { debug: 1 } : {}
	)).fetchAll();
};

exports.getChat = function(id) {
	return new Memory.MessengerChat({
		id: id
	}).fetch({
		withRelated: ['contact']
	});
};

exports.getAlarmsAt = function(when) {
	return new Memory.Alarm()
	.where(_.extend({ 
		io: exports.id,
		when: when,
		notified: 0
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
	console.ai(TAG, 'output', params);

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

		if (params.text) {
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
		sessionId: e.sender.id,
		ioId: e.sender.id,
		senderId: e.sender.id,
		title: e.sender.id
	};

	if (e.message.text) {
		log('[' + data.title + '] ' + e.message.text);
	}

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