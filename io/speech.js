const TAG = 'IO.Speech';

exports.capabilities = { 
	TAG: TAG,
	userCanViewUrls: false
};

const Recorder = require('node-record-lpcm16');
const SpeechRecognizer = require(__basedir + '/support/speechrecognizer');

let callback;

exports.onInput = function(cb) {
	callback = cb;
};

exports.startInput = function() {
	console.info(TAG, 'start');
	let data = { time: Date.now() };

	SpeechRecognizer.recognizeAudioStream(Recorder.start(), Recorder.stop)
	.then((text) => {
		console.user(TAG, text);
		callback(null, data, {
			text: text
		});
	})
	.catch((err) => {
		console.error(TAG, err);
		callback(err, data);
	});
};

exports.output = function(data, e) {
	console.ai(TAG, e);
	if (_.isString(e)) e = { text: e };
	
	if (e.text) {
		return new Promise((resolve, reject) => {
			require('child_process').spawn(__basedir + '/out-speech.sh', [ e.text ])
			.addListener('exit', (err) => {
				if (err) return reject(err);
				resolve();
			});
		});
	} 

	if (e.spotify) {
		return new Promise((resolve, reject) => {
			let spotify_script = require('spotify-node-applescript');
			if (e.spotify.song) {
				return spotify_script.playTrack(e.spotify.song.uri, resolve);
			}
			if (e.spotify.action) {
				spotify_script[e.spotify.action]();
				return resolve();
			}
			return reject();
		});
	}
	
	return Promise.reject();
};