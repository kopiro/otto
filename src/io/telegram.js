const TAG = 'IO.Telegram';
exports.id = 'telegram';

const _ = require('underscore');
const fs = require('fs');
const request = require('request');
const async = require('async');
const spawn = require('child_process').spawn;

const _config = _.defaults(config.io.telegram, {
	writeKeySpeed: 1
});

const emitter = exports.emitter = new (require('events').EventEmitter)();

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

function handleInputVoice(session_model, e) {
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
					language: session_model.getTranslateFrom()
				}, (err, text) => {
					if (err) return reject(err);
					resolve(text);
				});
				fs.createReadStream(voice_file + '.wav').pipe(recognize_stream);
			});

		});
	});
}

async function sendMessage(chat_id, text, telegram_opt) {
	const sentences = Util.mimicHumanMessage(text);
	await bot.sendChatAction(chat_id, 'typing');

	for (let sentence of sentences) {
		await bot.sendMessage(chat_id, sentence, telegram_opt);
		await timeout(Math.max(2000, _config.writeKeySpeed * sentence.length));
	}

	return true;
}

async function sendVoiceMessage(chat_id, text, language, telegram_opt) {
	const sentences = Util.mimicHumanMessage(text);
	await bot.sendChatAction(chat_id, 'record_audio');

	for (let sentence of sentences) {
		const polly_file = await Polly.getAudioFile(sentence, { language: language });
		const voice_file = await Play.fileToTmpFile(polly_file);
		await bot.sendVoice(chat_id, voice_file, telegram_opt);
	}

	return true;
}

exports.startInput = function() {
	if (started === true) return;
	started = true;

	if (_config.webhook) {
		bot.setWebHook(_config.webhook.url + _config.token, _config.webhook.options);
		bot.getWebHookInfo().then((e) => {
			console.info(TAG, 'started via webhook', e);
		});
	} else {
		console.info(TAG, 'started via polling');
	}
};

exports.output = async function(f, session_model) {
	console.info(TAG, 'output');
	console.dir({ f, session_model });
	
	const language = f.data.language || session_model.getTranslateTo();
	const chat_id = session_model.io_data.id;

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

	if (f.data.error) {
		if (f.data.error.speech) {		
			await sendMessage(chat_id, f.data.error.speech);
		} else {
			if (session_model.is_admin === true) {
				await sendMessage(chat_id, "ERROR\n```\n" + JSON.stringify(f.data.error) + "\n```");
			}
		}
	}

	if (f.speech) {
		if (session_model.getPipe().next_with_voice) {
			session_model.saveInPipe({ next_with_voice: false });
			await sendVoiceMessage(chat_id, f.speech, language, message_opt);
		} else {
			await sendMessage(chat_id, f.speech, message_opt);
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

	if (f.data.media) {
		if (f.data.media.artist) {
			await sendMessage(chat_id, f.data.media.artist.external_urls.spotify, message_opt);
		}
		if (f.data.media.track) {
			await sendMessage(chat_id, f.data.media.track.external_urls.spotify, message_opt);
		}
		if (f.data.media.playlist) {
			await sendMessage(chat_id, f.data.media.playlist.external_urls.spotify, message_opt);
		}
	}

	if (f.data.video) {
		if (f.data.video.remoteFile) {
			await bot.sendChatAction(chat_id, 'upload_video');
			await bot.sendVideo(chat_id, f.data.video.remoteFile, message_opt);
		} else if (f.data.video.localFile) {
			await bot.sendChatAction(chat_id, 'upload_video');
			await bot.sendVideo(chat_id, f.data.video.localFile, message_opt);
		}
	}

	if (f.data.image) {
		if (f.data.image.remoteFile) {
			await bot.sendChatAction(chat_id, 'upload_photo');
			await bot.sendPhoto(chat_id, f.data.image.remoteFile, message_opt);
		} else if (f.data.image.localFile) {
			await bot.sendChatAction(chat_id, 'upload_photo');
			await bot.sendPhoto(chat_id, f.data.image.localFile, message_opt);
		}
	}

	if (f.lyrics) {
		await sendMessage(chat_id, f.lyrics.lyrics_body, message_opt);
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
	const chat_is_group = (e.chat.type == 'group');

	let alias;
	switch (e.chat.type) {
		case 'private': alias = (e.chat.first_name + ' ' + e.chat.last_name); break;
		default: alias = e.chat.title; break;
	}

	// Register the session
	const session_model = await IOManager.registerSession({
		sessionId: sessionId,
		io_id: exports.id, 
		io_data: e.chat,
		alias: alias,
		text: e.text
	});

	if (e.text) {
		// If we are in a group, only listen for activators
		if (chat_is_group === true && !AI_NAME_ACTIVATOR.test(e.text)) {
			console.debug(TAG, 'skipping input for missing activator', e.text);
			return false;
		}
		emitter.emit('input', {
			session_model: session_model,
			params: {
				text: e.text
			}
		});
		return true;
	}

	if (e.voice) {
		try {
			const text = await handleInputVoice(session_model, e);
		
			// If we are in a group, only listen for activators
			if (chat_is_group === true || !AI_NAME_ACTIVATOR.test(e.text)) {
				console.debug(TAG, 'skipping input for missing activator', e.text);
				return false;
			}

			// User sent a voice note, respond with a voice note :)
			session_model.saveInPipe({ next_with_voice: true });
			emitter.emit('input', {
				session_model: session_model,
				params: {
					text: text
				}
			});
		} catch (err) {
			if (chat_is_group === true) return false;
			emitter.emit('input', {
				session_model: session_model,
				error: {
					speech: err.unrecognized ? ERRMSG_SR_UNRECOGNIZED : ERRMSG_SR_GENERIC
				}
			});
		}
		return true;
	}

	if (e.photo) {
		const photo_link = bot.getFileLink( _.last(e.photo).file_id );
		if (chat_is_group === true) return false;

		emitter.emit('input', {
			session_model: session_model,
			params: {
				image: {
					remoteFile: photo_link,
				}
			}
		});
		return true;
	}

	emitter.emit('input', {
		session_model: session_model,
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