const TAG = 'IO.Telegram';
exports.config = {
	id: 'telegram'
};

const _config = config.telegram;

const _ = require('underscore');
const fs = require('fs');
const request = require('request');

const emitter = (exports.emitter = new (require('events')).EventEmitter());

const Server = apprequire('server');
const TelegramBot = require('node-telegram-bot-api');
const SR = requireInterface('sr');
const TTS = requireInterface('tts');
const Play = apprequire('play');
const Proc = apprequire('proc');

/**
 * Telegram bot Client
 */
const bot = new TelegramBot(_config.token, _config.options);

let started = false;
const callback_queries = {};

/**
 * Handle a voice input by recognizing the text
 * @param {Object} session	Current session
 * @param {Object} e Telegram object
 */
async function handleInputVoice(session, e) {
	return new Promise(async resolve => {
		const file_link = await bot.getFileLink(e.voice.file_id);
		const voice_file = __tmpdir + '/' + uuid() + '.ogg';

		request(file_link)
			.pipe(fs.createWriteStream(voice_file))
			.on('close', async () => {
				await Proc.spawn('opusdec', [
					voice_file,
					voice_file + '.wav',
					'--rate',
					SR.SAMPLE_RATE
				]);
				const text = await SR.recognizeFile(voice_file + '.wav', {
					convertFile: false,
					language: session.getTranslateFrom()
				});
				resolve(text);
			});
	});
}

/**
 * Send a message to the user
 * @param {String} chat_id	Chat ID
 * @param {*} text Text to send
 * @param {*} opt Additional bot options
 */
async function sendMessage(chat_id, text, opt = {}) {
	await bot.sendChatAction(chat_id, 'typing');

	_.defaults(opt, {
		parse_mode: 'html'
	});

	bot.sendMessage(chat_id, text, opt);
}

/**
 * Send a voice message to the user
 * @param {*} chat_id Telegram Chat ID
 * @param {*} text Text to send
 * @param {*} language Language of sentence
 * @param {*} bot_opt Additional Telegram options
 */
async function sendVoiceMessage(chat_id, text, language, bot_opt = {}) {
	const sentences = mimicHumanMessage(text);
	await bot.sendChatAction(chat_id, 'record_audio');

	for (let sentence of sentences) {
		const audio_file = await TTS.getAudioFile(sentence, {
			language: language
		});
		const voice_file = await Play.playVoiceToTempFile(audio_file);
		await bot.sendVoice(chat_id, voice_file, bot_opt);
	}
}

/**
 * Start the polling/webhook cycle
 */
exports.startInput = function() {
	if (started) return;
	started = true;

	// We could attach the webhook to the Router API or via polling
	if (_config.useRouter && config.serverMode == true) {
		bot.setWebHook(config.server.domain + '/io/telegram/bot' + _config.token);
		Server.routerIO.use(
			'/telegram',
			require('body-parser').json(),
			(req, res) => {
				bot.processUpdate(req.body);
				res.sendStatus(200);
			}
		);
		console.info(TAG, 'started');
	} else {
		console.info(TAG, 'started via polling');
	}
};

/**
 * Output an object to the user
 * @param {Object} f	The item
 * @param {*} session The user session
 */
exports.output = async function(f, session) {
	console.info(TAG, 'output');
	console.dir(
		{
			f,
			session
		},
		{
			depth: 2
		}
	);

	// Inform observers
	emitter.emit('output', {
		session: session,
		fulfillment: f
	});

	// This is the Telegram Chat ID used to respond to the user
	const chat_id = session.io_data.id;
	const language = f.payload.language || session.getTranslateTo();

	let bot_opt = {};

	// If we have replies, set the bot opt to reflect the keyboard
	if (f.payload.replies != null) {
		bot_opt = {
			reply_markup: {
				resize_keyboard: true,
				one_time_keyboard: true,
				keyboard: [
					f.payload.replies.map(r => {
						if (_.isObject(r)) return r.text;
						if (_.isString(r)) return r;
					})
				]
			}
		};
	}

	// Process a Text Object
	try {
		if (f.fulfillmentText) {
			await sendMessage(chat_id, f.fulfillmentText, bot_opt);

			if (session.pipe.nextWithVoice) {
				session.savePipe({
					nextWithVoice: false
				});
				await sendVoiceMessage(chat_id, f.fulfillmentText, language, bot_opt);
			}
			if (f.payload.includeVoice) {
				await sendVoiceMessage(chat_id, f.fulfillmentText, language, bot_opt);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a URL Object
	try {
		if (f.payload.url) {
			await bot.sendMessage(chat_id, f.payload.url, bot_opt);
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Music object
	try {
		if (f.payload.music) {
			if (f.payload.music.spotify) {
				if (f.payload.music.spotify.track) {
					await sendMessage(
						chat_id,
						f.payload.music.spotify.track.external_urls.spotify,
						bot_opt
					);
				}
				if (f.payload.music.spotify.album) {
					await sendMessage(
						chat_id,
						f.payload.music.spotify.album.external_urls.spotify,
						bot_opt
					);
				}
				if (f.payload.music.spotify.artist) {
					await sendMessage(
						chat_id,
						f.payload.music.spotify.artist.external_urls.spotify,
						bot_opt
					);
				}
				if (f.payload.music.spotify.playlist) {
					await sendMessage(
						chat_id,
						f.payload.music.spotify.playlist.external_urls.spotify,
						bot_opt
					);
				}
			} else if (f.payload.music.uri) {
				await sendMessage(chat_id, f.payload.music.uri, bot_opt);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Video object
	try {
		if (f.payload.video) {
			if (f.payload.video.uri) {
				await bot.sendChatAction(chat_id, 'upload_video');
				await bot.sendVideo(chat_id, f.payload.video.uri, bot_opt);
			} else if (f.payload.video.youtube) {
				await bot.sendMessage(
					chat_id,
					'https://www.youtube.com/watch?v=' + f.payload.video.youtube.id,
					bot_opt
				);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process an Image Object
	try {
		if (f.payload.image) {
			if (f.payload.image.uri) {
				await bot.sendChatAction(chat_id, 'upload_photo');
				await bot.sendPhoto(chat_id, f.payload.image.uri, bot_opt);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process an Audio Object
	try {
		if (f.payload.audio) {
			if (f.payload.audio.uri) {
				await bot.sendChatAction(chat_id, 'upload_audio');
				await bot.sendAudio(chat_id, f.payload.audio.uri, bot_opt);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Voice Object
	try {
		if (f.payload.voice) {
			if (f.payload.voice.uri) {
				await bot.sendChatAction(chat_id, 'upload_audio');
				const voice_file = await Play.playVoiceToTempFile(f.payload.voice.uri);
				await bot.sendVoice(chat_id, voice_file, bot_opt);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Document Object
	try {
		if (f.payload.document) {
			if (f.payload.document.uri) {
				await bot.sendChatAction(chat_id, 'upload_document');
				await bot.sendDocument(chat_id, f.payload.document.uri, bot_opt);
			}
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Lyrics object
	try {
		if (f.payload.lyrics) {
			await sendMessage(chat_id, f.payload.lyrics.text, bot_opt);
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// ---- Telegram specific Objects ----

	// Process a Game Object
	try {
		if (f.payload.game) {
			callback_queries[chat_id] = callback_queries[chat_id] || {};
			callback_queries[chat_id][f.payload.game.id] = f.payload.game;
			await bot.sendGame(chat_id, f.payload.game.id);
		}
	} catch (err) {
		console.error(TAG, err);
	}

	// Process a Sticker Object
	try {
		if (f.payload.sticker) {
			await bot.sendSticker(chat_id, rand(f.payload.sticker), bot_opt);
		}
	} catch (err) {
		console.error(TAG, err);
	}
};

bot.on('webhook_error', err => {
	console.error(TAG, 'webhook error', err);
});

bot.on('message', async e => {
	console.info(TAG, 'input');
	console.dir(e, {
		depth: 2
	});

	const sessionId = e.chat.id;
	const chat_is_group = e.chat.type === 'group';

	let alias;
	switch (e.chat.type) {
		case 'private':
			alias = e.chat.first_name + ' ' + e.chat.last_name;
			break;
		default:
			alias = e.chat.title;
			break;
	}

	// Register the session
	const session = await IOManager.registerSession({
		sessionId: sessionId,
		io_driver: 'telegram',
		io_data: e.chat,
		alias: alias
	});

	// Process a Text object
	if (e.text) {
		// If we are in a group, only listen for activators
		if (chat_is_group && !AI_NAME_REGEX.test(e.text)) {
			console.debug(TAG, 'skipping input for missing activator', e.text);
			return false;
		}
		emitter.emit('input', {
			session: session,
			params: {
				text: e.text
			}
		});

		return true;
	}

	// Process a Voice object
	if (e.voice) {
		try {
			const text = await handleInputVoice(session, e);

			// If we are in a group, only listen for activators
			if (chat_is_group && !AI_NAME_REGEX.test(e.text)) {
				console.debug(TAG, 'skipping input for missing activator', e.text);
				return false;
			}

			// User sent a voice note, respond with a voice note :)
			session.savePipe({
				nextWithVoice: true
			});
			emitter.emit('input', {
				session: session,
				params: {
					text: text
				}
			});
		} catch (err) {
			if (chat_is_group === false) {
				return false;
			}
			if (err.unrecognized) {
				return emitter.emit('input', {
					session: IOManager.session,
					params: {
						event: 'io_SR_unrecognized'
					}
				});
			}
			return emitter.emit('input', {
				session: IOManager.session,
				error: err
			});
		}

		return true;
	}

	// Process a Photo Object
	if (e.photo) {
		const photo_link = bot.getFileLink(_.last(e.photo).file_id);
		if (chat_is_group) return false;

		emitter.emit('input', {
			session: session,
			params: {
				image: {
					uri: photo_link
				}
			}
		});

		return true;
	}

	emitter.emit('input', {
		session: session,
		error: {
			unkownInputType: true
		}
	});
});

bot.on('callback_query', e => {
	if (e.game_short_name) {
		const user = callback_queries[e.from.id];
		if (user) {
			if (user[e.game_short_name]) {
				bot.answerCallbackQuery(
					e.id,
					undefined,
					false,
					user[e.game_short_name]
				);
			}
		}
	}
});
