const child_process = require('child_process');
const Recorder = require('node-record-lpcm16');

const Speech = require('@google-cloud/speech')({
	keyFilename: './gcloud.json'
});

let AI_NAME_REGEX = /.*(otto|8|8:00) /;
AI_NAME_REGEX = /^/;

let timeout;
let callback;

exports.onInput = function(cb) {
	callback = cb;
};

exports.startInput = function() {
	console.info('IO.Speech', 'start');

	let processing = true;
	let recognized = false;
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
			let phrase = data.results;
			console.info('IO.Speech', 'Recognized: ' + phrase);

			if (AI_NAME_REGEX.test(phrase)) {
				console.info('IO.Speech', 'Keyword activation!');
				recognized = true;
				phrase = phrase.replace(AI_NAME_REGEX, '');

				console.user(phrase);

				callback({
					text: phrase
				});
			}

			case 'END_OF_UTTERANCE':
			case 'END_OF_AUDIO':
			if (processing) {
				processing = false;
				console.info('IO.Speech', 'Stopped listening');
				Recorder.stop();
				
				timeout = setTimeout(function() {
					if (!recognized) {
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

exports.output = function({text}) {
	return new Promise(function(resolve, reject) {
		console.ai(text);
		let childD = child_process.spawn('./out-speech.sh', [ text ]);
		childD.addListener('exit', function (code, signal) {
			childD = null;
			resolve(null);
		});
	});
};