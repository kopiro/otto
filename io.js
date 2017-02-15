const child_process = require('child_process');
const Recorder = require('node-record-lpcm16');
var fs = require('fs');

const Speech = require('@google-cloud/speech')({
	keyFilename: 'gcloud.json'
});

var AI_NAME_REGEX = /.*(otto|8|8:00) /;
AI_NAME_REGEX = /^/;

function inViaSpeech() {
	var self = this;

	return new Promise(function(resolve, reject) {
		var processing = true;
		var recognized = false;
		clearTimeout(self.timeout);

		const speechRecognizer = Speech.createRecognizeStream({
			singleUtterance: true,
			interimResults: false,
			config: {
				encoding: 'LINEAR16',
				sampleRate: 16000,
				languageCode: 'it-IT',
			}
		});

		speechRecognizer.on('data', function(data) {
			switch (data.endpointerType) {

				case 'START_OF_SPEECH':
				break;

				case 'ENDPOINTER_EVENT_UNSPECIFIED':
				var phrase = data.results;
				console.info('IO.speechData', 'Recognized: ' + phrase);

				if (AI_NAME_REGEX.test(phrase)) {
					console.info('IO.speechData', 'Keyword activation!');
					recognized = true;
					phrase = phrase.replace(AI_NAME_REGEX, '');

					console.user(phrase);

					resolve({
						text: phrase
					});
				}

				case 'END_OF_UTTERANCE':
				case 'END_OF_AUDIO':
				if (processing) {
					processing = false;
					console.info('IO.speechData', 'Stopped listening');
					Recorder.stop();
					self.timeout = setTimeout(function() {
						if (!recognized) {
							reject({
								message: "No word recognized by speech recognizer"
							});
						}
					}, 1000);
				}
				break;

			}
		});

		var recordingSteam = Recorder.start({
			sampleRate: 16000
		});
		//recordingSteam.pipe(fs.createWriteStream('/tmp/test.wav'));
		recordingSteam.pipe(speechRecognizer);

		console.info('IO.startListening');

	});
}

function outViaSpeech(text) {
	return new Promise(function(resolve, reject) {
		console.ai(text);
		var childD = child_process.spawn('./out-speech.sh', [ text ]);
		childD.addListener('exit', function (code, signal) {
			childD = null;
			resolve(null);
		});
	});
}


function inViaCode() {
	inViaCode.$ = inViaCode.$ || require('fs').readFileSync('in.txt').toString().split("\n");
	return new Promise(function(resolve, reject) {
		if (inViaCode.$.length == 0) {
			process.exit();
		}

		var msg = inViaCode.$.shift();
		console.user(msg);

		resolve({
			text: msg
		});
	});
}

function outViaStd(text) {
	return new Promise(function(resolve, reject) {
		console.ai(text);
		resolve();
	});
}

exports.input = inViaSpeech;
exports.output = outViaSpeech;

if (0) {
	exports.input = inViaCode;
	exports.output = outViaStd;
}
