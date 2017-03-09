const TAG = 'IO.Kid';

exports.capabilities = { 
	TAG: TAG,
	userCanViewUrls: false
};

const Recorder = require('node-record-lpcm16');
const SpeechRecognizer = require(__basedir + '/support/speechrecognizer');
const LumenVox = require(__basedir + '/support/lumenvoxhack');

let callback;

let is_speaking = false;
let is_speaking_timeout = null;
const SPEAKING_TIMEOUT = 5000;

const no_strategy_responses = [
'Scusa, ma non ho capito',
'Come scusa?',
'Potresti ripètere?'
];

exports.onInput = function(cb) {
	callback = cb;
	require('child_process').exec(__basedir + '/bin/start.sh');
};

exports.startInput = function() {
	console.info(TAG, 'start');
	let data = {};

	if (is_speaking == false) {
		// captureWebcam();
	}

	let recorderStream = Recorder.start(_.extend({
		sampleRate: 16000,
		verbose: false,
	}, config.recorder));

	SpeechRecognizer.recognizeAudioStream(recorderStream, () => {
		if (is_speaking) {
			clearTimeout(is_speaking_timeout);
			is_speaking_timeout = setTimeout(() => { 
				console.debug(TAG, 'is not speaking with user anymore');
				is_speaking = false; 
			}, SPEAKING_TIMEOUT);
		}

		Recorder.stop();
	})
	.then((text) => {
		is_speaking = true;

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
	e = e || {};
	if (_.isString(e)) e = { text: e };
	console.ai(TAG, e);

	return new Promise((resolve, reject) => {
		if (e.error) {
			if (e.error.noStrategy) {
				LumenVox.play(no_strategy_responses.getRandom(), () => {
					resolve();
				});
			} else if (e.error.text) {		
				return LumenVox.play(e.error.text, () => {
					resolve();
				});	
			} else {
				return resolve();
			}
		}

		if (e.text) {
			return LumenVox.play(e.text, () => {
				resolve();
			});
		} 

		if (e.media) {
			const mopidy = require(__basedir + '/support/mopidy');

			if (e.media.artist) {
				mopidy.onReady(() => {
					mopidy.tracklist.clear()
					.then(() => { return mopidy.library.lookup(e.media.artist.uri); })
					.then((tracks) => { return mopidy.tracklist.add(tracks); })
					.then((ttlTracks) => {
						mopidy.tracklist.shuffle();
						return mopidy.playback.play(ttlTracks[0]);
					})
					.catch((err) => {
						console.error(TAG, err);
					});
				});
				return resolve();
			}

			if (e.media.track) {
				mopidy.onReady(() => {
					mopidy.tracklist.clear()
					.then(() => { return mopidy.library.lookup(e.media.track.uri); })
					.then((tracks) => { return mopidy.tracklist.add(tracks); })
					.then((ttlTracks) => {
						return mopidy.playback.play(ttlTracks[0]);
					})
					.catch((err) => {
						console.error(TAG, err);
					});
				});
				return resolve();
			}

			if (e.media.action) {
				mopidy.playback[e.media.action](); 
				return resolve();
			}

			if (e.media.what) {
				mopidy.playback.setVolume(10)
				.then(() => { return mopidy.playback.getCurrentTrack(); })
				.then((track) => {
					const name = track.name;
					const artist = track.artists[0].name;
					return exports.output(data, { 
						text: [
						`Questa canzone si chiama ${name} di ${artist}`,
						`Bella questa! É ${name} di ${artist}!`,
						`Come fai a non conoscerla? Si tratta di ${name} di ${artist}`
						].getRandom()
					});
				})
				.catch(reject)
				.then(() => {
					mopidy.playback.setVolume(100)
					.then(resolve);
				});
				return;
			}

		}

		if (e.lyrics) {
			return LumenVox.play(e.lyrics.lyrics_body.split("\n")[0], () => {
				resolve();
			});
		}

		return resolve();
	});
};