const TAG = 'SpeechRecognizer';

const speech = require('@google-cloud/speech')({
	keyFilename: __basedir + '/keys/gcloud.json'
});
const spawn = require('child_process').spawn;


function createRecognizeStream(opt, callback) {
	let text = null;
	let timeout = null;

	const stream = speech.streamingRecognize({
		// If false or omitted, the recognizer will perform continuous recognition
		singleUtterance: true,
		// If true, interim results (tentative hypotheses) may be returned as they become available 
		interimResults: false,
		config: {
			encoding: opt.encoding || 'LINEAR16',
			sampleRateHertz: opt.sampleRate || 16000,
			languageCode: opt.locale
		}
	});

	stream.on('end', () => {
		console.debug(TAG, 'end');
		if (text == null) {
			callback({ unrecognized: true });
		}          
	});     

	stream.on('close', () => {
		console.debug(TAG, 'closed');
	});

	stream.on('error', (err) => {
		console.error(TAG, err);
		callback(err);
	});

	stream.on('data', (data) => {
		console.debug(TAG, 'data', JSON.stringify(data));
		if (data.results.length > 0) {
			var r = data.results[0];
			if (r.isFinal) {
				text = r.alternatives[0].transcript;
				console.info(TAG, 'recognized', text);
				callback(null, text);
			}
		}
	});

	return stream;
}

exports.recognizeAudioStream = function(stream, opt) {
	console.debug(TAG, 'recognizing an audio stream', opt);

	return new Promise((resolve, reject) => {
		opt = _.defaults(opt || {}, {
		});

		const locale = Util.getLocaleFromLanguageCode(opt.language);

		stream.pipe(createRecognizeStream({
			locale: locale
		}, (err, text) => {
			if (err) return reject(err);
			resolve(text);
		}));
	});
};