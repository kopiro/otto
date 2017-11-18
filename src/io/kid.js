const TAG = 'IO.Kid';
exports.id = 'kid';

const _ = require('underscore');
const async = require('async');

const _config = _.defaults(config.io.kid || {}, {
	waitForActivator: false,
	eocMax: 10,
	firstHint: 'Dimmi'
});

const emitter = exports.emitter = new (require('events').EventEmitter)();

const Rec = apprequire('rec');
const SpeechRecognizer = apprequire('speechrecognizer');
const Polly = apprequire('polly');
const Play = apprequire('play');
const RaspiLeds = apprequire('raspi/leds');
const URLManager = apprequire('urlmanager');
const {Detector, Models} = require('snowboy');
const Translator = apprequire('translator');

const md5 = require('md5');

let isHavingConversation = false;

let queueOutput = [];
let queueInterval = null;
let queueRunning = false;

let eocInterval = null;
let eocTimeout = -1;

const models = new Models();
models.add({
	file: __etcdir + '/hotword.pmdl',
	sensitivity: '0.6',
	hotwords: _config.hotword
});

let currentOutputKey = null;

function sendOutput(text, language = IOManager.sessionModel.getTranslateTo()) {
	return new Promise(async(resolve, reject) => {
		const key = md5(text);
		currentOutputKey = key;

		const sentences = Util.mimicHumanMessage(text);
		for (let sentence of sentences) {
			if (currentOutputKey === key) {
				let polly_file = await Polly.getAudioFile(sentence, { language: language });
				await Play.fileToSpeaker(polly_file);
			}
		}

		resolve();
	});
}

function stopOutput() {
	if (Play.speakerProc != null) {
		console.warn(TAG, 'stop output');
		currentOutputKey = null;
		Play.speakerProc.kill();
	}
}

async function sendFirstHint(language = IOManager.sessionModel.getTranslateTo()) {
	let hint = await Translator.translate(_config.firstHint, language, 'it');
	return sendOutput(hint);
}

let recognizeStream;

function createRecognizeStream() {
	console.log(TAG, 'recognizing mic stream');

	recognizeStream = SpeechRecognizer.createRecognizeStream({
		language: IOManager.sessionModel.translate_from
	}, (err, text) => {
		emitter.emit('user-spoken');

		if (err) {
			return emitter.emit('input', {
				session_model: IOManager.sessionModel,
				error: {
					speech: err.unrecognized ? ERRMSG_SR_UNRECOGNIZED : ERRMSG_SR_GENERIC
				}
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
	emitter.emit('user-can-speak');

	return recognizeStream;
}

function stopRecognizingStream() {
	console.debug(TAG, 'stop recognizing stream');
	if (recognizeStream != null) {
		recognizeStream.destroy();
	}
}

function registerGlobalSession(callback) {
	IOManager.registerSession({
		sessionId: CLIENT_ID,
		io_id: exports.id, 
		io_data: { platform: process.platform }
	}, true)
	.then(() => {
		console.log(TAG, 'global session registered', IOManager.sessionModel);
		callback();
	})
	.catch((sm) => {
		console.error(TAG, 'global session rejected', sm);
	});
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
			// console.log(TAG, eocTimeout + ' seconds remaining');
			eocTimeout--;
		}
	}, 1000);
}

function getDetectorStream() {
	emitter.emit('ai-hotword-listening');

	eocTimeout = -1;

	const detector = new Detector({
		resource: __etcdir + '/common.res',
		models: models,
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
	exports.startInput(); 
}

function processOutputQueue() {
	if (queueOutput.length === 0) return;
	if (queueRunning === true) return;

	queueRunning = true;
	eocTimeout = -1;
	stopRecognizingStream();

	let f = queueOutput[0];
	console.debug(TAG, 'process output queue', f);
	let promise;

	if (f.data.error) {
		if (f.data.error.speech) {	
			promise = sendOutput(f.data.error.speech, f.data.language);
		} else {
			promise = Promise.resolve();
		}
	} else {

		if (f.data.url) {
			URLManager.open(f.data.url);
		}

		if (f.speech) {
			promise = sendOutput(f.speech, f.data.language);
		} else if (f.data.lyrics) {
			const speech = f.data.lyrics.lyrics_body.split("\n")[0];
			promise = sendOutput(speech);
		}

	}

	if (promise == null) {
		promise = Promise.reject({ unkownOutputType: true });
	}

	// Attach to the sendOutput (or equivalent) promise to restart
	// the AI listening
	promise
	.then(shiftQueue)
	.catch(shiftQueue);

	return promise;
}

exports.startInput = function() {
	if (queueOutput.length > 0) return;
	console.debug(TAG, 'start input');

	if (IOManager.sessionModel == null) {
		return registerGlobalSession(exports.startInput);
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
		Rec.getStream().pipe(createRecognizeStream());
	}
};

exports.output = function(f) {
	console.info(TAG, 'output added to queue', f);
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

emitter.on('user-can-speak', () => {
	if (ledAnimation) ledAnimation.stop();
	RaspiLeds.setColor([ 0, 255, 0 ]);
});

emitter.on('user-spoken', () => {
	if (ledAnimation) ledAnimation.stop();
	ledAnimation = RaspiLeds.animateRandom();
});
