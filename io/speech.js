const TAG = 'IO.Speech';

exports.capabilities = { 
	TAG: TAG,
	user_can_view_urls: false
};

let callback;

exports.onInput = function(cb) {
	callback = cb;
};

exports.startInput = function() {
	console.info(TAG, 'start');
	let Recorder = require('node-record-lpcm16');

	const speechRecognizer = SpeechRecognizer.createRecognizeStream({
		sampleRate: 16000
	}, function(e) {
		callback(e);
	}, function() {
		Recorder.stop();
	});

	Recorder.start({
		sampleRate: 16000
	}).pipe(speechRecognizer);
};

exports.output = function(e) {
	console.ai(TAG, 'output', e);
	
	if (e.text) {
		return new Promise((resolve, reject) => {
			let childD = require('child_process').spawn(__basedir + '/out-speech.sh', [ e.text ]);
			childD.addListener('exit', resolve);
		});
	} 

	if (e.spotify) {
		return new Promise((resolve, reject) => {
			let spotify_script = require('spotify-node-applescript');
			if (e.spotify.song) {
				spotify_script.playTrack(e.spotify.song.uri, resolve);
				return resolve();
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