const speechClient = require('@google-cloud/speech')({
	keyFilename: __basedir + '/keys/gcloud.json'
});

const TAG = 'SpeechRecognizer';

function createRecognizeStream(opt, callback) {
	let processing = true;
	let recognized = false;
	let text = null;
	let timeout = null;

	console.debug(TAG, 'creating recognize stream', opt);

	const speechRecognizer = speechClient.createRecognizeStream({
		// If false or omitted, the recognizer will perform continuous recognition
		singleUtterance: true,
		// If true, interim results (tentative hypotheses) may be returned as they become available 
		interimResults: false,
		config: {
			encoding: opt.encoding || 'LINEAR16',
			sampleRate: opt.sampleRate || 16000,
			languageCode: opt.locale
		}
	});

	speechRecognizer.on('error', (err) => {
		console.error(TAG, err);
		callback(err);
	});

	speechRecognizer.on('data', function(data) {
		console.debug(TAG, data.endpointerType);
		switch (data.endpointerType) {

			case 'START_OF_SPEECH':
			// console.debug(TAG, 'start of speech');
			break;

			case 'ENDPOINTER_EVENT_UNSPECIFIED':
			text = data.results;
			console.info(TAG, text);
			clearTimeout(timeout);
			callback(null, text);
			break;

			case 'END_OF_UTTERANCE':
			case 'END_OF_SPEECH':
			case 'END_OF_AUDIO':
			if (text == null) {
				timeout = setTimeout(() => {
					callback({ unrecognized: true });
				}, 500);
			}
			break;
		}
	});

	return speechRecognizer;
}

exports.recognizeAudioStream = function(stream, opt) {
	return new Promise((resolve, reject) => {

		opt = _.defaults(opt || {}, {
			must_convert: false
		});

		if (opt.must_convert) {

			const tmp_file_audio = __tmpdir + '/' + require('uuid').v4() + '.flac';
			const sampleRate = 16000;

			const rec_stream = createRecognizeStream({
				sampleRate: sampleRate,
				encoding: 'FLAC',
				locale: Util.getLocaleFromLanguageCode(opt.language)
			}, (err, text) => {
				if (err) return reject(err);
				resolve(text);
			}, () => {
				fs.unlink(tmp_file_audio, () => {});
			});

			require('fluent-ffmpeg')(stream)
			.output(tmp_file_audio)
			.outputOptions(['-ac 1', `-ar ${sampleRate}`])
			.on('end', () => {
				fs.createReadStream(tmp_file_audio).pipe(rec_stream);
			})
			.on('error', (err) => {
				reject(err);
			})
			.run();

		} else {
			stream.pipe(createRecognizeStream({
				locale: Util.getLocaleFromLanguageCode(opt.language)
			}, (err, text) => {
				if (err) return reject(err);
				resolve(text);
			}));
		}
	});
};