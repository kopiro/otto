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

let isConversation = false;
let sessionModel = null;
let eocInterval = null;
let eocTimeout = -1;

const models = new Models();
models.add({
	file: __etcdir + '/hotword.pmdl',
	sensitivity: '0.6',
	hotwords: _config.hotword
});

function sendMessage(text, language) {
	return new Promise((resolve, reject) => {
		eocTimeout = -1; // Inibit timer while AI is talking
		language = language || sessionModel.translate_to || config.language;

		const sentences = Util.mimicHumanMessage(text);
		async.eachSeries(sentences, (t, next) => {
			Polly.getAudioFile(t, {
				language: language
			})
			.then((polly_file) => {
				emitter.emit('ai-speaking');
				Play.fileToSpeaker(polly_file, (err) => {
					if (err) return reject(err);
					next();
				});
			})
			.catch(reject);
		}, () => {
			eocTimeout = _config.eocMax;
			emitter.emit('ai-spoken');
			resolve();
		});
	});
}

function sendFirstHint() {
	return sendMessage(_config.firstHint);
}

function recognizeMicStream() {
	isConversation = true;
	console.log(TAG, 'recognizing mic stream');

	emitter.emit('user-can-speak');

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

		IOManager.writeLogForSession(sessionModel.id, text);

		emitter.emit('input', {
			session_model: sessionModel,
			params: {
				text: text
			}
		});
	});

	recognizeStream.on('data', (data) => {
		if (data.results.length > 0) {
			eocTimeout = _config.eocMax;
		}
	});

	Rec.start().pipe(recognizeStream);
}

function registerGlobalSession(callback) {
	IOManager.registerSession(CLIENT_ID, exports.id, { platform: process.platform })
	.then((sm) => {
		sessionModel = sm;
		console.log(TAG, 'global session registered', sessionModel);
		callback();
	})
	.catch((sm) => {
		console.error(TAG, 'global session rejected', sm);
	});
}

function listenForHotWord() {
	console.warn(TAG, 'waiting for hotword');
	emitter.emit('ai-hotword-listening');

	const detector = new Detector({
		resource: __etcdir + '/common.res',
		models: models,
		audioGain: 1.0
	});

	detector.on('hotword', function (index, hotword, buffer) {
		console.log(TAG, 'hotword');
		emitter.emit('ai-hotword-recognized');

		// Stop streaming to detector
		Rec.stop();
	
		// Send the first hit and listen
		sendFirstHint()
		.then(recognizeMicStream);
	});

	detector.on('silence', () => {
		process.stdout.write('〰️');
	});

	detector.on('sound', (buffer) => {
		process.stdout.write('🔉 ');
	});

	detector.on('error', (err) => {
		console.error(TAG, err);
	});

	Rec.start().pipe(detector);
}

exports.startInput = function() {
	console.debug(TAG, 'startInput');

	if (sessionModel == null) {
		return registerGlobalSession(exports.startInput);
	}

	if (eocInterval == null) {
		eocInterval = setInterval(() => {
			if (eocTimeout == 0) {
				console.warn(TAG, 'timeout exceeded for conversation');
				
				isConversation = false;
				eocTimeout = -1;
				Rec.stop();
				
				setTimeout(() => {
					emitter.emit('input', {
						session_model: sessionModel,
						error: {
							eoc: true
						}
					});
				}, 1000);

			} else if (eocTimeout > 0) {
				console.log(TAG, eocTimeout + ' seconds remaining');
				eocTimeout--;
			}
		}, 1000);
	}

	if (isConversation) {
		recognizeMicStream();
		return;
	}

	listenForHotWord();
};

exports.output = function(f) {
	console.info(TAG, 'output', sessionModel.id, f);

	return new Promise((resolve, reject) => {
		if (f.data.error) {
			if (f.data.error.speech) {	
				sendMessage(f.data.error.speech, f.data.language)
				.then(resolve)
				.catch(reject);
			} else {
				return resolve();
			}
		}

		if (f.data.url) {
			URLManager.open(f.data.url);
		}

		if (f.speech) {
			return sendMessage(f.speech, f.data.language)
			.then(resolve)
			.catch(reject);
		} 

		if (f.data.lyrics) {
			const speech = f.data.lyrics.lyrics_body.split("\n")[0];
			return sendMessage(speech).then(resolve);
		}

		return reject({ unkownOutputType: true });
	});
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
