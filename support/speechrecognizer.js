const speechClient = require('@google-cloud/speech')({
	keyFilename: __basedir + '/keys/gcloud.json'
});

const TAG = 'SpeechRecognizer';

function createRecognizeStream(opt, callback, end) {
	let processing = true;
	let recognized = false;
	end = end || (() => {});

	const speechRecognizer = speechClient.createRecognizeStream({
		// If false or omitted, the recognizer will perform continuous recognition
		singleUtterance: false,
		// If true, interim results (tentative hypotheses) may be returned as they become available 
		interimResults: false,
		config: {
			encoding: opt.encoding || 'LINEAR16',
			sampleRate: opt.sampleRate || 16000,
			languageCode: config.locale,
		}
	});

	speechRecognizer.on('error', (err) => {
		console.error(TAG, err);
		callback(err);
		end();
	});

	speechRecognizer.on('data', function(data) {
		switch (data.endpointerType) {

			case 'START_OF_SPEECH':
			console.debug(TAG, 'start of speech');
			break;

			case 'ENDPOINTER_EVENT_UNSPECIFIED':
			let text = data.results;
			console.debug(TAG, 'recognized: ' + text);
			recognized = true;
			callback(null, text);
			// no-break

			case 'END_OF_UTTERANCE':
			case 'END_OF_AUDIO':
			end();
			end = (() => {}); // who the first call
			break;

		}
	});

	return speechRecognizer;
}

exports.recognizeAudioStream = function(stream, end, must_convert) {
	return new Promise((resolve, reject) => {

		if (must_convert) {

			const tmp_file_audio = __tmpdir + '/' + require('uuid').v4() + '.flac';
			const sampleRate = 16000;

			const rec_stream = createRecognizeStream({
				sampleRate: sampleRate,
				encoding: 'FLAC'
			}, (err, text) => {
				if (err) return reject(err);
				resolve(text);
			}, () => {
				end();
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
			stream.pipe(createRecognizeStream({}, (err, text) => {
				if (err) return reject(err);
				resolve(text);
			}, end));
		}
	});
};