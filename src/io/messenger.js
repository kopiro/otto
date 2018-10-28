const TAG = 'IO.Messenger';
exports.config = {
	id: 'messenger',
	onlyServerMode: true
};

const _config = config.messenger;

const _ = require('underscore');
const fs = require('fs');
const request = require('request');

const emitter = exports.emitter = new(require('events').EventEmitter)();

const Server = apprequire('server');
const MessengerBot = require('messenger-bot');
const Play = apprequire('play');

/**
 * Messenger bot Client
 */
const bot = new MessengerBot(_config);

let started = false;

/**
 * Send a message to the user
 * @param {String} chat_id	Chat ID 
 * @param {*} text Text to send
 * @param {*} opt Additional bot options
 */
async function sendMessage(chat_id, text, opt = {}) {
	await bot.sendSenderAction(chat_id, 'typing');

	_.defaults(opt, {
		parse_mode: 'html'
	});

	bot.sendMessage(chat_id, text, opt);
}

/**
 * Start the polling/webhook cycle
 */
exports.startInput = function () {
	if (started === true) return;
	started = true;

	// Attach to the server
	if (config.serverMode == true) {
		Server.routerIO.use('/messenger', bot.middleware());
		console.info(TAG, 'started');
	} else {
		console.error(TAG, 'unable to start in client mode; enable serverMode in config');
	}
};

/**
 * Output an object to the user
 * @param {Object} f	The item 
 * @param {*} session The user session
 */
exports.output = async function (f, session) {
	console.info(TAG, 'output');
	console.dir({
		f,
		session
	}, {
		depth: 2
	});

	// Inform observers
	emitter.emit('output', {
		session: session,
		fulfillment: f
	});

	const chat_id = session.io_data.sender.id;
	const language = f.data.language || session.getTranslateTo();

	let bot_opt = {};

	// If we have replies, set the bot opt to reflect the keyboard
	if (f.data.replies) {
		bot_opt = {
			quick_replies: f.data.replies.map((r) => {
				if (_.isString(r)) r = {
					id: r,
					text: r
				};
				return {
					title: r.text,
					data: r.id,
					content_type: 'text',
				};
			})
		};
	}

	// Process an error
	try {
		if (f.data.error) {
			if (f.data.error.speech) {
				await sendMessage(chat_id, f.data.error.speech);
			}
			if (session.is_admin === true) {
				await sendMessage(chat_id, "ERROR: <code>" + JSON.stringify(f.data.error) + "</code>");
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Speech Object
	try {
		const speech = f.speech || f.data.speech;
		if (speech) {
			await sendMessage(chat_id, speech, bot_opt);
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a URL Object
	try {
		if (f.data.url) {
			await bot.sendMessage(chat_id, f.data.url, bot_opt);
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Music object
	try {
		if (f.data.music) {
			if (f.data.music.spotify) {
				if (f.data.music.spotify.track) {
					await sendMessage(chat_id, f.data.music.spotify.track.share_url, bot_opt);
				}
				if (f.data.music.spotify.album) {
					await sendMessage(chat_id, f.data.music.spotify.album.share_url, bot_opt);
				}
				if (f.data.music.spotify.artist) {
					await sendMessage(chat_id, f.data.music.spotify.artist.share_url, bot_opt);
				}
				if (f.data.music.spotify.playlist) {
					await sendMessage(chat_id, f.data.music.spotify.playlist.share_url, bot_opt);
				}
			} else if (f.data.music.uri) {
				await sendMessage(chat_id, f.data.music.uri, bot_opt);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Video object
	try {
		if (f.data.video) {
			if (f.data.video.uri) {
				await bot.sendSenderAction(chat_id, 'upload_video');
				await bot.sendVideo(chat_id, f.data.video.uri, bot_opt);
			} else if (f.data.video.youtube) {
				await bot.sendMessage(chat_id, 'https://www.youtube.com/watch?v=' + f.data.video.youtube.id, bot_opt);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process an Image Object
	try {
		if (f.data.image) {
			if (f.data.image.uri) {
				await bot.sendSenderAction(chat_id, 'upload_photo');
				await bot.sendPhoto(chat_id, f.data.image.uri, bot_opt);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process an Audio Object
	try {
		if (f.data.audio) {
			if (f.data.audio.uri) {
				await bot.sendSenderAction(chat_id, 'upload_audio');
				await bot.sendAudio(chat_id, f.data.audio.uri, bot_opt);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Voice Object
	try {
		if (f.data.voice) {
			if (f.data.voice.uri) {
				await bot.sendSenderAction(chat_id, 'upload_audio');
				const voice_file = await Play.playVoiceToTempFile(f.data.voice.uri);
				await bot.sendVoice(chat_id, voice_file, bot_opt);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Document Object
	try {
		if (f.data.document) {
			if (f.data.document.uri) {
				await bot.sendSenderAction(chat_id, 'upload_document');
				await bot.sendDocument(chat_id, f.data.document.uri, bot_opt);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Lyrics object
	try {
		if (f.data.lyrics) {
			await sendMessage(chat_id, f.data.lyrics.text, bot_opt);
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// ---- Messenger specific options ----
};

bot.on('error', (err) => {
	console.error(TAG, 'webhook error', err);
});

bot.on('message', (e) => {
	console.info(TAG, 'input');
	console.dir(e, {
		depth: 2
	});

	let sessionId = e.sender.id;

	bot.getProfile(sessionId, async (err, profile) => {
		if (err) {
			console.error(TAG, 'unable to get profile', err);
			return;
		}

		// Register the session
		const session = await IOManager.registerSession({
			sessionId: sessionId,
			io_driver: 'messenger',
			io_data: {
				profile: profile,
				sender: e.sender
			},
			alias: profile.first_name + ' ' + profile.last_name
		});

		const chat_id = session.io_data.sender.id;

		// Set this message as seen
		bot.sendSenderAction(chat_id, 'mark_seen');

		// Process a Text object
		if (e.message.text) {
			emitter.emit('input', {
				session: session,
				params: {
					text: e.message.text
				}
			});
			return;
		}

		// Process Attachments
		if (e.message.attachments && e.message.attachments[0].type === 'image') {
			const attach = e.message.attachments[0];
			emitter.emit('input', {
				session: session,
				params: {
					image: {
						uri: attach.payload.url,
					}
				}
			});
			return;
		}

		emitter.emit('input', {
			session: session,
			error: {
				unkownInputType: true
			}
		});
	});

});