const TAG = 'IO.Messenger';
exports.config = {
	id: 'messenger'
};

const _config = config.messenger;

const _ = require('underscore');

const emitter = exports.emitter = new (require('events').EventEmitter)();

const Server = apprequire('server');
const MessengerBot = require('messenger-bot');
const SpeechRecognizer = apprequire('speechrecognizer');
const Polly = apprequire('polly');
const Play = apprequire('play');

const bot = new MessengerBot(_config);

let started = false;

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

async function sendMessage(chat_id, text, messenger_opt = {}) {
	const sentences = mimicHumanMessage(text);
	await bot.sendSenderAction(chat_id, 'typing');

	for (let sentence of sentences) {
		messenger_opt = _.extend(messenger_opt, { text: sentence });
		await bot.sendMessage(chat_id, messenger_opt);
		await timeout(Math.max(2000, sentence.length));
	}

	return true;
}

async function sendVoiceMessage(chat_id, text, language, telegram_opt) {
	const sentences = mimicHumanMessage(text);
	await bot.sendSenderAction(chat_id, 'record_audio');

	for (let sentence of sentences) {
		const polly_file = await Polly.getAudioFile(sentence, { language: language });
		const voice_file = await Play.playToTempFile(polly_file);
		await bot.sendVoice(chat_id, voice_file, telegram_opt);
	}

	return true;
}


exports.startInput = function() {
	if (started === true) return;
	started = true;
	
	Server.routerIO.use('/messenger', bot.middleware());
	console.info(TAG, 'started');
};

exports.output = async function(f, session) {
	console.info(TAG, 'output');
	console.dir({ f, session });

	emitter.emit('output', {
		session: session,
		fulfillment: f
	});

	const language = f.data.language || session.getTranslateTo();
	const chat_id = session.io_data.sender.id;

	if (f.data.error) {
		if (f.data.error.speech) {	
			await sendMessage(chat_id, f.data.error.speech);
		}
		if (session.is_admin === true) {
			await sendMessage(chat_id, "ERROR: `" + JSON.stringify(f.data.error) + "`");
		}

		return;
	}

	let message_opt = {};

	if (f.data.replies) {
		message_opt = {
			quick_replies: f.data.replies.map((r) => {
				if (_.isString(r)) r = { id: r, text: r };
				return {
					title: r.text,
					data: r.id,
					content_type: 'text',
				};
			})
		};
	}


	const speech = f.speech || f.data.speech;
	if (speech) {
		await sendMessage(chat_id, speech, message_opt);
	}

	if (f.data.url) {
		await sendMessage(chat_id, f.data.url, message_opt);
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
		if (f.data.video.uri) {
			await bot.sendSenderAction(chat_id, 'upload_video');
			await bot.sendVideo(chat_id, f.data.video.uri, message_opt);
		}
	}

	if (f.data.image) {
		if (f.data.image.uri) {
			await bot.sendSenderAction(chat_id, 'upload_photo');
			await bot.sendPhoto(chat_id, f.data.image.uri, message_opt);
		}
	}

	if (f.data.audio) {
		if (f.data.audio.uri) {
			await bot.sendSenderAction(chat_id, 'upload_audio');
			await bot.sendAudio(chat_id, f.data.audio.uri, message_opt);
		}
	}

	if (f.lyrics) {
		await sendMessage(chat_id, f.lyrics.text, message_opt);
	}
};

bot.on('error', (err) => {
	console.error(TAG, err);
});

bot.on('message', (e) => {
	console.info(TAG, 'input');
	console.dir(e);

	let sessionId = e.sender.id;

	bot.getProfile(sessionId, async(err, profile) => {
		if (err) {
			console.error(TAG, 'unable to get profile', err);
			return;
		}

		const session = await IOManager.registerSession({
			sessionId: sessionId,
			io_driver: 'messenger', 
			io_data: {
				profile: profile,
				sender: e.sender
			},
			alias: profile.first_name + ' ' + profile.last_name,
			text: e.message.text
		});

		const chat_id = session.io_data.sender.id;
		bot.sendSenderAction(chat_id, 'mark_seen');

		if (e.message.text) {
			emitter.emit('input', {
				session: session,
				params: {
					text: e.message.text
				}
			});
			return;
		}

		if (e.message.attachments) {
			const attach = _.first(e.message.attachments);
			if (attach.type === 'image') {
				emitter.emit('input', {
					session: session,
					params: {
						image: {
							uri: attach.payload.url,
						}
					}
				});
			}
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