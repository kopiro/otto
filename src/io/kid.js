const TAG = 'IO.Kid';
exports.id = 'kid';

const _ = require('underscore');
const async = require('async');
const md5 = require('md5');
const request = require('request');
const fs = require('fs');

const _config = config.kid;

const emitter = exports.emitter = new (require('events').EventEmitter)();

const Rec = apprequire('rec');
const SpeechRecognizer = apprequire('speechrecognizer');
const Polly = apprequire('polly');
const Play = apprequire('play');
const RaspiLeds = apprequire('raspi/leds');
const URLManager = apprequire('urlmanager');
const {Detector, Models} = require('snowboy');
const HotwordTrainer = apprequire('hotword_trainer');
const Translator = apprequire('translator');
const Messages = apprequire('messages');

let isHavingConversation = false;

let queueOutput = [];
let queueInterval = null;
let queueRunning = false;

let eocInterval = null;
let eocTimeout = -1;

let hotwordScanned = false;
let hotwordModels = null;

let currentOutputKey = null;

async function scanForHotWords(forceTraining = false) {	
	return new Promise(async(resolve, reject) => {
		if (forceTraining) await HotwordTrainer.start();

		fs.readdir(__etcdir + '/hotwords-pmdl/', {}, async(err, files) => {
			if (err) return reject(err);
			files = files.filter((file) => /\.pmdl$/.test(file));
			
			if (files.length > 0) {
				console.debug(TAG, 'scanned ' + files.length + ' pdml files');

				hotwordModels = new Models();
				files.forEach((file) => {
					hotwordModels.add({
						file: __etcdir + '/hotwords-pmdl/' + file,
						sensitivity: '0.5',
						hotwords: config.snowboy.hotword
					});
				});

				hotwordScanned = true;
				return resolve();
			}

			// Train first time
			await HotwordTrainer.start();			
			return scanForHotWords();
		});
	});
}

async function sendMessage(text, language) {
	const key = md5(text);
	currentOutputKey = key;
	language = language || IOManager.sessionModel.getTranslateTo();
	
	const sentences = mimicHumanMessage(text);

	for (let sentence of sentences) {
		if (currentOutputKey === key) {
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
	console.warn(TAG, 'stop output');
	currentOutputKey = null;
	if (Play.speakerProc != null) {
		Play.speakerProc.kill();
	}
}

async function sendFirstHint(language) {
	language = language || IOManager.sessionModel.getTranslateTo();
	let hint = await Translator.translate(Messages.get('io_first_hint'), language, config.language);
	return sendMessage(hint, language);
}

let recognizeStream;

function createRecognizeStream() {
	console.log(TAG, 'recognizing mic stream');

	recognizeStream = SpeechRecognizer.createRecognizeStream({
		language: IOManager.sessionModel.getTranslateFrom()
	}, (err, text) => {
		emitter.emit('user-spoken');

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
			eocTimeout = _config.eocMax;
		}
	});

	eocTimeout = _config.eocMax;

	return recognizeStream;
}

function stopRecognizingStream() {
	console.debug(TAG, 'stop recognizing stream');
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

function registerEOCInterval() {
	if (eocInterval != null) return;
	eocInterval = setInterval(() => {
		if (eocTimeout == 0) {
			console.warn(TAG, 'timeout exceeded for conversation');

			isHavingConversation = false;
			eocTimeout = -1;
			exports.startInput();

		} else if (eocTimeout > 0) {
			// console.debug(TAG, eocTimeout + ' seconds remaining');
			eocTimeout--;
		}
	}, 1000);
}

function getDetectorStream() {
	eocTimeout = -1;

	const detector = new Detector({
		resource: __etcdir + '/common.res',
		models: hotwordModels,
		audioGain: 1.0
	});

	detector.on('hotword', async() => {
		console.log(TAG, 'hotword');
		emitter.emit('ai-hotword-recognized');
		
		isHavingConversation = true;
		stopOutput();

		await sendFirstHint();
		exports.startInput();
	});

	detector.on('silence', () => {
		process.stdout.write('〰️');
	});

	detector.on('sound', () => {
		process.stdout.write('🔉 ');
	});

	detector.on('error', (err) => {
		console.error(TAG, err);
	});

	return detector;
}

function shiftQueue() {
	console.debug(TAG, 'shifting queue');
	queueOutput.shift();
	queueRunning = false;
	emitter.emit('ai-spoken');
	exports.startInput(); 
}

async function processOutputQueue() {
	if (queueOutput.length === 0) return;
	if (queueRunning === true) return;

	emitter.emit('ai-speaking');

	queueRunning = true;
	eocTimeout = -1;
	stopRecognizingStream();

	let f = queueOutput[0];
	
	console.debug(TAG, 'process output queue');
	console.dir(f);

	if (f.data.error) {
		if (f.data.error.speech) {	
			await sendMessage(f.data.error.speech, f.data.language);
		}
		if (IOManager.sessionModel.is_admin === true) {
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
		await sendMessage(f.data.lyrics.lyrics_body);
	}

	shiftQueue();
}

exports.startInput = async function() {
	if (queueOutput.length > 0) return;
	console.debug(TAG, 'start input');

	if (IOManager.sessionModel == null) {
		await registerGlobalSession();
	}

	if (hotwordScanned === false) {
		await scanForHotWords(false);
	}

	if (queueInterval == null) {
		queueInterval = setInterval(processOutputQueue, 100);
	}

	if (eocInterval == null) {
		registerEOCInterval();
	}

	Rec.start();
	Rec.getStream().pipe(getDetectorStream());

	if (isHavingConversation) {
		emitter.emit('user-can-speak');
		Rec.getStream().pipe(createRecognizeStream());
	} else {
		emitter.emit('ai-hotword-listening');
	}
};

exports.output = async function(f) {
	console.info(TAG, 'output added to queue');
	queueOutput.push(f);
};

/////////////////////
// Setup RaspiLeds //
/////////////////////

let ledAnimation;

emitter.on('ai-hotword-listening', () => {
	if (ledAnimation) ledAnimation.stop();
	RaspiLeds.off();
});

emitter.on('ai-hotword-recognized', () => {
	if (ledAnimation) ledAnimation.stop();
	RaspiLeds.setColor([ 0, 0, 255 ]);
});

emitter.on('ai-speaking', () => {
	if (ledAnimation) ledAnimation.stop();
	RaspiLeds.setColor([ 255, 255, 0 ]);
});

emitter.on('ai-spoken', () => {
	if (ledAnimation) ledAnimation.stop();
	RaspiLeds.off();
});

emitter.on('user-can-speak', () => {
	if (ledAnimation) ledAnimation.stop();
	RaspiLeds.setColor([ 0, 255, 0 ]);
});

emitter.on('user-spoken', () => {
	if (ledAnimation) ledAnimation.stop();
	ledAnimation = RaspiLeds.animateRandom();
});
