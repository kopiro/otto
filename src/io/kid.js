const TAG = 'IO.Kid';

const md5 = require('md5');
const fs = require('fs');

const _config = config.kid;

const emitter = exports.emitter = new (require('events').EventEmitter)();

const Rec = apprequire('rec');
const SpeechRecognizer = apprequire('speechrecognizer');
const Polly = apprequire('polly');
const Play = apprequire('play');
const URLManager = apprequire('urlmanager');
const { Detector } = require('snowboy');
const Hotword = apprequire('hotword');
const Translator = apprequire('translator');
const Messages = apprequire('messages');

const Mopidy = apprequire('mopidy');
const ChromeCast = apprequire('chromecast');

let isRecognizing = false;
let isInputStarted = false;

let recognizeStream;
let hotwordDetectorStream;

let queueOutput = [];
let queueIntv;
let queueProcessingItem;

const WAKE_WORD_TICKS = 6;
const EOR_MAX = 8;

let wakeWordTick = -1;
let eorInterval = null;
let eorTick = -1;

let hotwordModels = null;

let currentSendMessageKey = null;

async function sendMessage(text, language) {
	const key = md5(text);
	currentSendMessageKey = key;
	language = language || IOManager.session.getTranslateTo();
	
	const sentences = mimicHumanMessage(text);

	for (let sentence of sentences) {
		if (currentSendMessageKey === key) {
			let polly_file = await Polly.getAudioFile(sentence, { language: language });
			await Play.fileToSpeaker(polly_file);
		}
	}

	return true;
}

async function processEvent(event) {
	switch (event) {
		case 'hotword_recognized_first_hint':
		eorTick = EOR_MAX;
		createRecognizeStream();
		break;
	}
}

async function sendVoice(e) {
	if (e.uri) {
		await Play.urlToSpeaker(e.uri);
	}
}

async function sendVideo(e, session) {
	if (e.youtube) {
		const client = await ChromeCast.connect(session.settings.chromecast);
		ChromeCast.castYoutubeVideo(client, e.youtube.id);
	}
}

async function sendMusic(e) {
	await Mopidy.connect();
	
	if (e.action) {
		await Mopidy.playback[e.action]();
	}
	if (e.track) {
		await Mopidy.playTrackByUriNow(e.track.uri);
	}
	if (e.what) {
		await Mopidy.playback.setVolume(10);
		const track = await Mopidy.playback.getCurrentTrack();
		await sendMessage(Messages.get('playback_current_track_is', track.name, track.artists[0].name, track.albums[0].name));
		await Mopidy.playback.setVolume(100);
	}
}

function stopOutput() {
	console.info(TAG, 'stop output');
	currentSendMessageKey = null;
	queueProcessingItem = null;
	queueOutput = [];
	Play.kill();
	if (Mopidy.playback) Mopidy.playback.stop();
}

function createRecognizeStream() {
	console.log(TAG, 'recognizing microphone stream');

	recognizeStream = SpeechRecognizer.createRecognizeStream({
		language: IOManager.session.getTranslateFrom()
	}, (err, text) => {
		destroyRecognizeStream();

		if (err) {
			if (err.unrecognized) {
				return emitter.emit('input', {
					params: {
						event: 'io_speechrecognizer_unrecognized'
					}
				});
			}
			return emitter.emit('input', {
				error: err
			});
		}

		emitter.emit('input', {
			params: {
				text: text
			}
		});

		IOManager.writeLogForSession(IOManager.session, text);
	});

	// When user speaks, reset the timer to the max
	recognizeStream.on('data', (data) => {
		if (data.results.length > 0) {
			eorTick = EOR_MAX;
		}
	});

	isRecognizing = true;
	emitter.emit('recognizing');

	Rec.getStream().pipe(recognizeStream);
	return recognizeStream;
}

function destroyRecognizeStream() {
	isRecognizing = false;
	emitter.emit('notrecognizing');

	if (recognizeStream != null) {
		Rec.getStream().unpipe(recognizeStream);
		recognizeStream.destroy();
	}
}

async function registerGlobalSession() {
	return IOManager.registerSession({
		sessionId: null, // act as a global session
		io_driver: 'kid', 
		io_data: {}
	});
}

function registerEORInterval() {
	if (eorInterval) clearInterval(eorInterval);
	eorInterval = setInterval(() => {
		if (eorTick == 0) {
			console.info(TAG, 'timeout exceeded for conversation');
			eorTick = -1;
			destroyRecognizeStream();
		} else if (eorTick > 0) {
			console.debug(TAG, eorTick + ' seconds remaining');
			eorTick--;
		}
	}, 1000);
}

function registerOutputQueueInterval() {
	if (queueIntv) clearInterval(queueIntv);
	queueIntv = setInterval(processOutputQueue, 1000);
}

function wake() {
	console.info(TAG, 'wake');

	emitter.emit('wake');
	stopOutput();
	wakeWordTick = 0;
	eorTick = EOR_MAX;
	destroyRecognizeStream();
	createRecognizeStream();
}

exports.wake = wake;

function stop() {
	console.info(TAG, 'stop');

	emitter.emit('stop');
	stopOutput();
	wakeWordTick = -1;
	eorTick = -1;
	destroyRecognizeStream();
}

exports.stop = stop;

function createHotwordDetectorStream() {
	hotwordDetectorStream = new Detector({
		resource: __etcdir + '/common.res',
		models: hotwordModels,
		audioGain: 1.0
	});

	hotwordDetectorStream.on('hotword', async(index, hotword, buffer) => {
		switch (hotword) {
			case 'wake':
			wake();
			break;
			// case 'stop':
			// stop();
			// break;
		}
	});

	hotwordDetectorStream.on('silence', async() => {
		// process.stdout.write('〰️');
		if (isRecognizing && wakeWordTick !== -1) {
			if (++wakeWordTick == WAKE_WORD_TICKS) {
				wakeWordTick = -1;
				console.info(TAG, `detected ${WAKE_WORD_TICKS} ticks of consecutive silence, prompt user`);
				destroyRecognizeStream();
				emitter.emit('input', {
					params: {
						event: 'hotword_recognized_first_hint'
					}
				});
			}
		}
	});

	hotwordDetectorStream.on('sound', (buffer) => {
		wakeWordTick = -1;
		process.stdout.write('🔉 ');
	});

	hotwordDetectorStream.on('error', (err) => {
		console.error(TAG, err);
	});

	Rec.getStream().pipe(hotwordDetectorStream);

	return hotwordDetectorStream;
}

async function processOutputQueue() {
	if (queueOutput.length === 0 || queueProcessingItem != null) {
		return;
	}

	const session = IOManager.session;
	const f = queueOutput[0];
	console.debug(TAG, 'processing queue item');

	eorTick = -1; // temporary disable timer
	queueProcessingItem = f;
	destroyRecognizeStream();

	emitter.emit('output', {
		session: session,
		fulfillment: f
	});

	try {

		if (f.data.eventBeforeSpeech) {
			await processEvent(f.data.eventBeforeSpeech);
		}

		if (f.data.error) {
			if (f.data.error.speech) {	
				await sendMessage(f.data.error.speech, f.data.language);
			}
			if (session.is_admin === true) {
				await sendMessage(String(f.data.error), 'en');
			}
		}

		if (f.data.url) {
			URLManager.open(f.data.url);
		}

		if (f.speech) {
			await sendMessage(f.speech, f.data.language);
		}

		if (f.data.voice) {
			await sendVoice(f.data.voice);
		}

		if (f.data.lyrics) {
			await sendMessage(f.data.lyrics.text, f.data.lyrics.language);
		}

		if (f.data.music) {
			await sendMusic(f.data.music);
		}

		if (f.data.video) {
			await sendVideo(f.data.video, session);
		}

		if (f.data.eventAfterSpeech) {
			await processEvent(f.data.eventAfterSpeech);
		}

	} catch (err) {
		console.error(TAG, err);
	}

	queueProcessingItem = null;
	queueOutput.shift();

	if (f.data.feedback) {
		emitter.emit('thinking');
	}

	if (f.data.welcome) {
		emitter.emit('stop');
	}

	if (!f.data.feedback && !f.data.welcome && queueOutput.length === 0) {
		eorTick = EOR_MAX;
		createRecognizeStream();
	}
}

exports.startInput = async function() {
	console.debug(TAG, 'start input');

	await registerGlobalSession();

	hotwordModels = await Hotword.getModels();
	registerOutputQueueInterval();
	registerEORInterval();

	emitter.emit('input', {
		params: {
			event: {
				name: 'welcome',
				data: {
					name: IOManager.session.alias || config.uid
				}
			}
		}
	});

	isInputStarted = true;
	
	Rec.start();
	createHotwordDetectorStream();
};

exports.stopInput = async function() {
	Rec.stop();
};

exports.output = async function(f) {
	console.debug(TAG, 'output');
	console.dir(f, { depth: 10 });
	queueOutput.push(f);
};