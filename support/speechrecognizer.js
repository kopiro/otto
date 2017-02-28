const speechClient = require('@google-cloud/speech')({
	keyFilename: __basedir + '/gcloud.json'
});

const TAG = 'SpeechRecognizer';

let timeout;

function createRecognizeStream(opt, callback, end) {
	let processing = true;
	let recognized = false;
	clearTimeout(timeout);

	const speechRecognizer = speechClient.createRecognizeStream({
		singleUtterance: true,
		interimResults: false,
		config: {
			encoding: opt.encoding || 'LINEAR16',
			sampleRate: opt.sampleRate || 16000,
			languageCode: config.locale,
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

				recognized = true;
				callback(null, text);
			// no-break

			case 'END_OF_UTTERANCE':
			case 'END_OF_AUDIO':
			if (processing) {
				console.debug(TAG, 'end of audio/utterance');
				processing = false;
				if (end) end();

				timeout = setTimeout(function() {
					if (!recognized) {
						callback("No word recognized by speech recognizer");
					}
				}, 1000);
			}
			break;

		}
	});

	return speechRecognizer;
}

exports.recognizeAudioStream = function(stream, end, must_convert) {
	return new Promise((resolve, reject) => {

		if (must_convert) {

			const tmp_file_audio = require('os').tmpdir() + Date.now() + '.flac';
			const sampleRate = 16000;

			const rec_stream = createRecognizeStream({
				sampleRate: sampleRate,
				encoding: 'FLAC'
			}, (err, text) => {
				if (err) return reject(err);
				resolve(text);
			}, () => {
				if (end) end();
				fs.unlink(tmp_file_audio);
			});

			require('fluent-ffmpeg')(stream)
			.output(tmp_file_audio)
			.outputOptions(['-ac 1', `-ar ${sampleRate}`])
			.on('end', () => {
				fs.createReadStream(tmp_file_audio)
				.pipe(rec_stream);
			})
			.on('error', (err) => {
				reject(err);
			})
			.run();

		} else {

			const rec_stream = createRecognizeStream({}, (err, text) => {
				if (err) return reject(err);
				resolve(text);
			}, () => {
				if (end) end();
			});

			stream.pipe(rec_stream);

		}
	});
};