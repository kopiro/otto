const TAG = 'IO.Kid';
exports.id = 'kid';

const _ = require('underscore');
const async = require('async');

const _config = _.defaults(config.io.kid || {}, {
	waitForActivator: false,
	eocMax: 7,
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

let havingConversation = false;
let isHotwordListening = false;

let queueOutput = [];
let queueInterval = null;
let queueRunning = false;

let sessionModel = null;
let eocInterval = null;
let eocTimeout = -1;

const models = new Models();
models.add({
	file: __etcdir + '/hotword.pmdl',
	sensitivity: '0.6',
	hotwords: _config.hotword
});

function sendMessage(text, language = sessionModel.getTranslateTo()) {
	return new Promise(async(resolve, reject) => {
		
		const sentences = Util.mimicHumanMessage(text);
		for (let sentence of sentences) {
			let polly_file = await Polly.getAudioFile(sentence, { language: language });
			await Play.fileToSpeaker(polly_file);
		}

		emitter.emit('ai-spoken');

		resolve();
	});
}

async function sendFirstHint(language = sessionModel.getTranslateTo()) {
	let hint = await Translator.translate(_config.firstHint, language, 'it');
	return sendMessage(hint);
}

function recognizeMicStream() {
	console.log(TAG, 'recognizing mic stream');

	const recognizeStream = SpeechRecognizer.createRecognizeStream({
		language: sessionModel.translate_from
	}, (err, text) => {
		Rec.stop();
		emitter.emit('user-spoken');

		if (err) {
			return emitter.emit('input', {
				session_model: sessionModel,
				error: {
					speech: err.unrecognized ? ERRMSG_SR_UNRECOGNIZED : ERRMSG_SR_GENERIC
				}
			});
		}

		emitter.emit('input', {
			session_model: sessionModel,
			params: {
				text: text
			}
		});

		IOManager.writeLogForSession(sessionModel.id, text);
	});

	// When user speaks, reset the timer to the max
	recognizeStream.on('data', (data) => {
		if (data.results.length > 0) {
			eocTimeout = _config.eocMax;
		}
	});

	Rec.start().pipe(recognizeStream);
	eocTimeout = _config.eocMax;
	emitter.emit('user-can-speak');
}

function registerGlobalSession(callback) {
	IOManager.registerSession({
		sessionId: CLIENT_ID,
		io_id: exports.id, 
		io_data: { platform: process.platform }
	})
	.then((sm) => {
		sessionModel = sm;

		queueInterval = setInterval(processOutputQueue, 100);
		if (eocInterval == null) {
			registerEOCInterval();
		}

		console.log(TAG, 'global session registered', sessionModel);
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

			havingConversation = false;
			isHotwordListening = false;
			eocTimeout = -1;

			Rec.stop();
			exports.startInput();

		} else if (eocTimeout > 0) {
			console.log(TAG, eocTimeout + ' seconds remaining');
			eocTimeout--;
		}
	}, 1000);
}

function listenForHotWord() {
	if (isHotwordListening) return;
	isHotwordListening = true;

	console.debug(TAG, 'waiting for hotword');
	emitter.emit('ai-hotword-listening');

	eocTimeout = -1;

	const detector = new Detector({
		resource: __etcdir + '/common.res',
		models: models,
		audioGain: 1.0
	});

	detector.on('hotword', async(index, hotword, buffer) => {
		console.log(TAG, 'hotword');
		emitter.emit('ai-hotword-recognized');
		
		// Set flags
		havingConversation = true;
		isHotwordListening = false;

		// Stop streaming to detectors
		Rec.stop();

		// Send the first hit and listen
		await sendFirstHint();
		recognizeMicStream();
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

	Rec.start().pipe(detector);
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
	exports.stopInput();

	let f = queueOutput[0];
	console.debug(TAG, 'process output queue', f);
	let promise;

	if (f.data.error) {
		if (f.data.error.speech) {	
			promise = sendMessage(f.data.error.speech, f.data.language);
		} else {
			promise = Promise.resolve();
		}
	} else {

		if (f.data.url) {
			URLManager.open(f.data.url);
		}

		if (f.speech) {
			promise = sendMessage(f.speech, f.data.language);
		} else if (f.data.lyrics) {
			const speech = f.data.lyrics.lyrics_body.split("\n")[0];
			promise = sendMessage(speech);
		}

	}

	if (promise == null) {
		promise = Promise.reject({ unkownOutputType: true });
	}

	// Attach to the sendMessage (or equivalent) promise to restart
	// the AI listening
	promise
	.then(shiftQueue)
	.catch(shiftQueue);

	return promise;
}

exports.startInput = function() {
	if (queueOutput.length > 0) return;
	console.debug(TAG, 'start input');

	if (sessionModel == null) {
		return registerGlobalSession(exports.startInput);
	}

	eocTimeout = _config.eocMax;

	if (havingConversation) {
		recognizeMicStream();
		return;
	}

	listenForHotWord();
};

exports.stopInput = function() {
	console.debug(TAG, 'stop input');
	eocTimeout = -1;
	Rec.stop();
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
