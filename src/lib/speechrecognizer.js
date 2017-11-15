const TAG = 'SpeechRecognizer';

const speech = require('@google-cloud/speech')({
	keyFilename: __basedir + '/keys/gcloud.json'
});
const spawn = require('child_process').spawn;

exports.createRecognizeStream = function(opt, callback) {
	let finished = false;

	const stream = speech.streamingRecognize({
		// If false or omitted, the recognizer will perform continuous recognition
		singleUtterance: true,
		// If true, interim results (tentative hypotheses) may be returned as they become available 
		interimResults: true,
		config: {
			encoding: opt.encoding || 'LINEAR16',
			sampleRateHertz: opt.sampleRate || 16000,
			languageCode: Util.getLocaleFromLanguageCode(opt.language)
		}
	});

	// stream.on('end', () => {
	// 	console.debug(TAG, 'end');
	// 	if (false === finished) {
	// 		finished = true;
	// 		callback({ unrecognized: true });
	// 	}      
	// });     

	stream.on('error', (err) => {
		console.error(TAG, err);
		callback(err);
	});

	stream.on('data', (data) => {
		console.debug(TAG, 'data', JSON.stringify(data));
		if (data.results.length > 0) {
			var r = data.results[0];
			if (r.isFinal) {
				const text = r.alternatives[0].transcript;
				console.info(TAG, 'recognized', text);
				callback(null, text);
			}
		}
	});

	return stream;
};