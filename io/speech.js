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

	const speechRecognizer = new SpeechRecognizer({
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
	console.ai(TAG, 'output', JSON.stringify(e, null, 2));
	
	if (e.text) {
		return new Promise((resolve, reject) => {
			let childD = require('child_process').spawn(__basedir + '/out-speech.sh', [ e.text ]);
			childD.addListener('exit', resolve);
		});
	} else if (e.spotify) {
		return new Promise((resolve, reject) => {
			require('spotify-node-applescript').playTrack(e.spotify.uri, resolve);
		});
	} else {
		return Promise.resolve();
	}
};