const child_process = require('child_process');
const Recorder = require('node-record-lpcm16');
var fs = require('fs');

const Speech = require('@google-cloud/speech')({
	keyFilename: 'gcloud.json'
});

function inViaCode() {
	return new Promise(function(resolve, reject) {
		resolve({
			text: 'che tempo fa a Roma'
		});
	});
}

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
			console.log('IO.inViaSpeech:', data.endpointerType);
			switch (data.endpointerType) {

				case 'START_OF_SPEECH':
				break;

				case 'ENDPOINTER_EVENT_UNSPECIFIED':
				var phrase = data.results;
				console.log('IO: Phrase recognized:', phrase);
				recognized = true;
				resolve({
					text: phrase
				});

				case 'END_OF_UTTERANCE':
				case 'END_OF_AUDIO':
				if (processing) {
					processing = false;
					console.log('IO: Stopped listening');
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
	});
}

function outViaSpeech(text) {
	return new Promise(function(resolve, reject) {
		var childD = child_process.spawn('./out-speech.sh', [ text ]);
		childD.addListener('exit', function (code, signal) {
			childD = null;
			resolve(null);
		});
	});
}

function outViaStd(text) {
	// console.log(text);
}

exports.input = inViaSpeech;
exports.output = outViaSpeech;

// exports.input = inViaCode;
// exports.output = outViaStd;