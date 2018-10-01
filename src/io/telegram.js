const TAG = 'IO.Telegram';
exports.config = {
	id: 'telegram'
};

const _config = config.telegram;

const _ = require('underscore');
const fs = require('fs');
const request = require('request');
const spawn = require('child_process').spawn;

const emitter = exports.emitter = new (require('events').EventEmitter)();

const Server = apprequire('server');
const TelegramBot = require('node-telegram-bot-api');
const SpeechRecognizer = apprequire('speechrecognizer');
const Polly = apprequire('polly');
const Play = apprequire('play');

const bot = new TelegramBot(_config.token, _config.options);

let started = false;

const STICKERS = {
	me: 'CAADBAADRQMAAokSaQP3vsj1u7oQ9wI',
	logo: 'CAADBAADRAMAAokSaQMXx8V8QvEybAI'
};

function handleInputVoice(session, e) {
	return new Promise(async(resolve, reject) => {		
		const file_link = await bot.getFileLink(e.voice.file_id);
		const voice_file = __tmpdir + '/' + uuid() + '.ogg';
		const voice_file_stream = fs.createWriteStream(voice_file);

		request(file_link)
		.pipe(voice_file_stream)
		.on('close', () => {
			
			let proc = spawn('opusdec', [ voice_file, voice_file + '.wav', '--rate', 16000 ]);
			let stderr = '';
			proc.stderr.on('data', (buf) => { stderr += buf; });
			proc.on('close', async(err) => {
				if (err) return reject(stderr);
				
				const recognize_stream = SpeechRecognizer.createRecognizeStream({
					interimResults: false,
					language: session.getTranslateFrom()
				}, (err, text) => {
					if (err) return reject(err);
					resolve(text);
				});
				fs.createReadStream(voice_file + '.wav').pipe(recognize_stream);
			});

		});
	});
}

async function sendMessage(chat_id, text, telegram_opt = {}) {
	await bot.sendChatAction(chat_id, 'typing');

	_.defaults(telegram_opt, {
		parse_mode: 'html'
	});

	try {
		await bot.sendMessage(chat_id, text, telegram_opt);
	} catch (err) {
		console.warn(TAG, err);
	}

	return true;
}

async function sendVoiceMessage(chat_id, text, language, telegram_opt) {
	const sentences = mimicHumanMessage(text);
	await bot.sendChatAction(chat_id, 'record_audio');

	for (let sentence of sentences) {
		const polly_file = await Polly.getAudioFile(sentence, { language: language });
		const voice_file = await Play.playToTempFile(polly_file);
		await bot.sendVoice(chat_id, voice_file, telegram_opt);
	}

	return true;
}

exports.startInput = function() {
	if (started) return;
	started = true;

	if (_config.useRouter) {
		bot.setWebHook(config.server.domain + '/io/telegram/bot' + _config.token);
		Server.routerIO.use('/telegram', require('body-parser').json(), (req, res) => {
			bot.processUpdate(req.body);
			res.sendStatus(200);
		});
	} else {
		console.info(TAG, 'started via polling');
	}
};

exports.output = async function(f, session) {
	console.info(TAG, 'output');
	console.dir({ f, session }, { depth: 10 });

	emitter.emit('output', {
		session: session,
		fulfillment: f
	});
	
	const language = f.data.language || session.getTranslateTo();
	const chat_id = session.io_data.id;

	if (f.data.error) {
		if (f.data.error.speech) {		
			await sendMessage(chat_id, f.data.error.speech);
		}
		if (session.is_admin) {
			await sendMessage(chat_id, "ERROR: <code>" + JSON.stringify(f.data.error) + "</code>");
		}
		return;
	}

	// Process replies
	let message_opt = {};
	if (f.data.replies != null) {
		message_opt = {
			reply_markup: {
				resize_keyboard: true,
				one_time_keyboard: true,
				keyboard: [ 
				f.data.replies.map((r) => { 
					if (_.isObject(r)) return r.text; 
					if (_.isString(r)) return r;
				}) 
				]
			}
		};
	}

	const speech = f.speech || f.data.speech;
	if (speech) {
		if (session.pipe.next_with_voice) {
			session.savePipe({ next_with_voice: false });
			await sendVoiceMessage(chat_id, speech, language, message_opt);
		} else {
			await sendMessage(chat_id, speech, message_opt);
		}
	}

	if (f.data.url) {
		await bot.sendMessage(chat_id, f.data.url, message_opt);
	}

	if (f.data.game) {
		callback_queries[chat_id] = callback_queries[chat_id] || {};
		callback_queries[chat_id][f.data.game.id] = f.data.game;
		await bot.sendGame(chat_id, f.data.game.id);
	}

	if (f.data.music) {
		if (f.data.music.track) {
			await sendMessage(chat_id, f.data.music.track.share_url, message_opt);
		}
		if (f.data.music.album) {
			await sendMessage(chat_id, f.data.music.album.share_url, message_opt);
		}
		if (f.data.music.artist) {
			await sendMessage(chat_id, f.data.music.artist.share_url, message_opt);
		}
		if (f.data.music.playlist) {
			await sendMessage(chat_id, f.data.music.playlist.share_url, message_opt);
		}
	}

	if (f.data.video) {
		if (f.data.video.uri || f.data.video.file) {
			await bot.sendChatAction(chat_id, 'upload_video');
			await bot.sendVideo(chat_id, f.data.video.uri || f.data.video.file, message_opt);
		}
	}

	if (f.data.image) {
		if (f.data.image.uri || f.data.image.file) {
			await bot.sendChatAction(chat_id, 'upload_photo');
			await bot.sendPhoto(chat_id, f.data.image.uri || f.data.image.file, message_opt);
		}
	}

	if (f.data.audio) {
		if (f.data.audio.uri || f.data.audio.file) {
			await bot.sendChatAction(chat_id, 'upload_audio');
			await bot.sendAudio(chat_id, f.data.audio.uri || f.data.audio.file, message_opt);
		}
	}

	if (f.data.document) {
		if (f.data.document.uri || f.data.document.file) {
			await bot.sendChatAction(chat_id, 'upload_document');
			await bot.sendDocument(chat_id, f.data.document.uri || f.data.document.file, message_opt);
		}
	}

	if (f.data.lyrics) {
		await sendMessage(chat_id, f.data.lyrics.text, message_opt);
	}

	if (f.data.sticker) {
		await bot.sendSticker(chat_id, rand(f.data.sticker), message_opt);
	}
};

/////////////////
// Init events //
/////////////////

bot.on('webhook_error', (err) => {
	console.error(TAG, 'webhook error', err);
});

bot.on('message', async(e) => {
	console.info(TAG, 'input');
	console.dir(e);

	const sessionId = e.chat.id;
	const chat_is_group = (e.chat.type === 'group');

	let alias;
	switch (e.chat.type) {
		case 'private': alias = (e.chat.first_name + ' ' + e.chat.last_name); break;
		default: alias = e.chat.title; break;
	}

	// Register the session
	const session = await IOManager.registerSession({
		sessionId: sessionId,
		io_driver: 'telegram',
		io_data: e.chat,
		alias: alias,
		text: e.text
	});

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

	if (e.voice) {
		try {
			const text = await handleInputVoice(session, e);
		
			// If we are in a group, only listen for activators
			if (chat_is_group && !AI_NAME_REGEX.test(e.text)) {
				console.debug(TAG, 'skipping input for missing activator', e.text);
				return false;
			}

			// User sent a voice note, respond with a voice note :)
			session.savePipe({ next_with_voice: true });
			emitter.emit('input', {
				session: session,
				params: {
					text: text
				}
			});
		} catch (err) {
			if (chat_is_group) return false;
			if (err.unrecognized) {
				return emitter.emit('input', {
					session: IOManager.session,
					params: {
						event: 'io_speechrecognizer_unrecognized'
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

	if (e.photo) {
		const photo_link = bot.getFileLink( _.last(e.photo).file_id );
		if (chat_is_group) return false;

		emitter.emit('input', {
			session: session,
			params: {
				image: {
					uri: photo_link,
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

const callback_queries = {};

bot.on("callback_query", (e) => {
	if (e.game_short_name) {
		const user = callback_queries[e.from.id];
		if (user) {
			if (user[e.game_short_name]) {
				bot.answerCallbackQuery(e.id, undefined, false, user[e.game_short_name]);
			}
		}
	}
});