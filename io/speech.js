const TAG = 'IO.Speech';

exports.capabilities = { 
	TAG: TAG,
	userCanViewUrls: false
};

const Recorder = require('node-record-lpcm16');
const SpeechRecognizer = require(__basedir + '/support/speechrecognizer');

let __onInputCallback;

exports.onInput = function(cb) {
	__onInputCallback = cb;
};

exports.startInput = function() {
	console.info(TAG, 'start');
	let data = { time: Date.now() };

	SpeechRecognizer.recognizeAudioStream(Recorder.start(), () => {
		Recorder.stop();
	})
	.then((text) => {
		console.user(TAG, text);
		__onInputCallback(null, data, {
			text: text
		});
	})
	.catch((err) => {
		console.error(TAG, err);
		__onInputCallback(err, data);
	});
};

exports.output = function(data, e) {
	return new Promise((resolve, reject) => {
		console.ai(TAG, e);
		if (_.isString(e)) e = { text: e };

		if (e.error) return resolve();

		if (e.text) {
			return require('child_process').spawn(__basedir + '/out-speech.sh', [ e.text ])
			.addListener('exit', (err) => {
				if (err) return reject(err);
				resolve();
			});
		} 

		if (e.spotify) {
			let spotify_script = require('spotify-node-applescript');
			if (e.spotify.song) {
				return spotify_script.playTrack(e.spotify.song.uri, resolve);
			}
			if (e.spotify.action) {
				spotify_script[e.spotify.action]();
				return resolve();
			}
			return reject();
		}

		return reject();
	});
};