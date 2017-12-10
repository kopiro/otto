const TAG = 'IO.Kid';
exports.id = 'kid';

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
	language = language || IOManager.sessionModel.getTranslateTo();
	
	const sentences = mimicHumanMessage(text);

	for (let sentence of sentences) {
		if (currentSendMessageKey === key) {
			let polly_file = await Polly.getAudioFile(sentence, { language: language });
			await Play.fileToSpeaker(polly_file);
		}
	}

	return true;
}

async function sendVoice(e) {
	if (e.remoteFile) {
		await Play.urlToSpeaker(e.remoteFile);
	} else if (e.localFile) {
		await Play.fileToSpeaker(e.localFile);
	}
}

function stopOutput() {
	console.info(TAG, 'stop output');
	currentSendMessageKey = null;
	queueProcessingItem = null;
	queueOutput = [];
	if (Play.speakerProc != null) {
		Play.speakerProc.kill();
	}
}

async function sendFirstHint(language) {
	language = language || IOManager.sessionModel.getTranslateTo();
	let hint = await Translator.translate(Messages.get('io_first_hint'), language, config.language);
	return sendMessage(hint, language);
}

function createRecognizeStream() {
	console.log(TAG, 'recognizing microphone stream');

	recognizeStream = SpeechRecognizer.createRecognizeStream({
		language: IOManager.sessionModel.getTranslateFrom()
	}, (err, text) => {
		destroyRecognizeStream();

		if (err) {
			if (err.unrecognized) {
				return emitter.emit('input', {
					session_model: IOManager.sessionModel,
					error: {
						speech: Messages.get('io_speechrecognizer_unrecognized')
					}
				});
			}
			return emitter.emit('input', {
				session_model: IOManager.sessionModel,
				error: err
			});
		}

		emitter.emit('input', {
			session_model: IOManager.sessionModel,
			params: {
				text: text
			}
		});

		IOManager.writeLogForSession(IOManager.sessionModel.id, text);
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
		recognizeStream.destroy();
	}
}

async function registerGlobalSession() {
	return IOManager.registerSession({
		sessionId: require('os').hostname(),
		uid: config.uid || uuid(),
		io_id: exports.id, 
		io_data: { platform: process.platform }
	}, true);
}

function registerEORInterval() {
	if (eorInterval) clearInterval(eorInterval);
	eorInterval = setInterval(() => {
		if (eorTick == 0) {
			console.info(TAG, 'timeout exceeded for conversation');
			eorTick = -1;
			destroyRecognizeStream();
			emitter.emit('stop');
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

function createHotwordDetectorStream() {
	hotwordDetectorStream = new Detector({
		resource: __etcdir + '/common.res',
		models: hotwordModels,
		audioGain: 1.0
	});

	hotwordDetectorStream.on('hotword', async(index, hotword, buffer) => {
		console.info(TAG, 'hotword event', hotword);

		switch (hotword) {
			case 'wake':
			emitter.emit('wake');
			stopOutput();
			wakeWordTick = 0;
			eorTick = EOR_MAX;
			destroyRecognizeStream();
			createRecognizeStream();
			break;
			case 'stop':
			emitter.emit('stop');
			stopOutput();
			wakeWordTick = -1;
			eorTick = -1;
			destroyRecognizeStream();
			break;
		}
	});

	hotwordDetectorStream.on('silence', async() => {
		process.stdout.write('〰️');
		if (isRecognizing && wakeWordTick !== -1) {
			if (++wakeWordTick == WAKE_WORD_TICKS) {
				wakeWordTick = -1;
				console.info(TAG, `detected ${WAKE_WORD_TICKS} ticks of consecutive silence, prompt user`);
				destroyRecognizeStream();
				await sendFirstHint();
				eorTick = EOR_MAX;
				createRecognizeStream();
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
	if (queueOutput.length === 0 || queueProcessingItem) {
		return;
	}

	const session_model = IOManager.sessionModel;
	const f = queueOutput[0];
	console.info(TAG, 'processing output queue', f);
	console.debug(TAG, 'current queue length =', queueOutput.length);

	eorTick = -1; // temporary disable timer
	queueProcessingItem = f;
	destroyRecognizeStream();

	emitter.emit('output', {
		sessionModel: session_model,
		fulfillment: f
	});

	try {
		if (f.data.error) {
			if (f.data.error.speech) {	
				await sendMessage(f.data.error.speech, f.data.language);
			}
			if (session_model.is_admin === true) {
				await sendMessage(String(f.data.error), 'en');
			}
		}

		if (f.data.url) {
			await URLManager.open(f.data.url);
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
	} catch (err) {
		console.error(TAG, err);
	}

	queueProcessingItem = null;
	queueOutput.shift();

	if (queueOutput.length === 0 && f.data.feedback == false) {
		eorTick = EOR_MAX; // re-enable at max
		createRecognizeStream();
	}
}

exports.startInput = async function() {
	console.debug(TAG, 'start input');

	await registerGlobalSession();

	hotwordModels = await Hotword.getModels();
	registerOutputQueueInterval();
	registerEORInterval();

	await sendMessage(Messages.get('driver_started'));

	isInputStarted = true;	

	Rec.start();
	createHotwordDetectorStream();
};

exports.stopInput = async function() {
	Rec.stop();
};

exports.output = async function(f) {
	console.debug(TAG, 'queueing output', f);
	queueOutput.push(f);
};