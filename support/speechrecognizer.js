const speechClient = require('@google-cloud/speech')({
	keyFilename: __basedir + '/gcloud.json'
});

const TAG = 'SR';

exports.createRecognizeStream = function(opt, callback, end) {
	let timeout;
	let processing = true;
	let recognized = false;

	const speechRecognizer = speechClient.createRecognizeStream({
		singleUtterance: true,
		interimResults: false,
		config: {
			encoding: opt.encoding || 'LINEAR16',
			sampleRate: opt.sampleRate,
			languageCode: 'it-IT',
		}
	});

	speechRecognizer.on('data', function(data) {
		switch (data.endpointerType) {

			case 'START_OF_SPEECH':
			console.debug(TAG, 'start of speech');	
			break;

			case 'ENDPOINTER_EVENT_UNSPECIFIED':
			let text = data.results;
			console.debug(TAG, 'recognized: ' + text);

			//if (AI_NAME_REGEX.test(text)) {
				// console.debug(TAG, 'activation');
				console.user(text);

				recognized = true;

				callback({
					text: text
				});
			// no-break

			case 'END_OF_UTTERANCE':
			case 'END_OF_AUDIO':
			if (processing) {
				console.debug(TAG, 'end of audio/utterance');
				processing = false;
				if (end) end();

				timeout = setTimeout(function() {
					if (!recognized) {
						console.error(TAG, 'not recognized');
						callback({
							error: "No word recognized by speech recognizer"
						});
					}
				}, 1000);
			}
			break;

		}
	});

	return speechRecognizer;
};