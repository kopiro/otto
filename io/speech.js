const child_process = require('child_process');
const Recorder = require('node-record-lpcm16');
const Speech = require('@google-cloud/speech')({
	keyFilename: './gcloud.json'
});

let AI_NAME_REGEX = /.*(otto|8|8:00|hey) /;
AI_NAME_REGEX = /^/;

let timeout;
let callback;
let processing;
let recognized;

exports.onInput = function(cb) {
	callback = cb;
};

exports.startInput = function() {
	console.info('IO.Speech', 'start');

	processing = true;
	recognized = false;
	clearTimeout(timeout);

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
			let text = data.results;
			console.info('IO.Speech', 'recognized: ' + text);

			if (AI_NAME_REGEX.test(text)) {
				console.info('IO.Speech', 'activation');
				console.user(text);

				recognized = true;
				text = text.replace(AI_NAME_REGEX, '');

				callback({
					text: text
				});
			} else {
				console.info('IO.Speech', 'no activation');
			}
			// no-break

			case 'END_OF_UTTERANCE':
			case 'END_OF_AUDIO':
			if (processing) {
				console.info('IO.Speech', 'stopped listening');
				processing = false;
				Recorder.stop();
				
				timeout = setTimeout(function() {
					if (!recognized) {
						console.error('IO.Speech', 'not recognized');
						callback({
							error: "No word recognized by speech recognizer"
						});
					}
				}, 1000);
			}
			break;

		}
	});

	let recordingSteam = Recorder.start({
		sampleRate: 16000
	});
	recordingSteam.pipe(speechRecognizer);
};

exports.output = function({ text }) {
	if (text == null) return;

	console.ai(text);

	return new Promise(function(resolve, reject) {
		let childD = child_process.spawn('./out-speech.sh', [ text ]);
		childD.addListener('exit', function(code, signal) {
			childD = null;
			resolve();
		});
	});
};