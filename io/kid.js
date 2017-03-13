const TAG = 'IO.Kid';

const EventEmitter = require('events').EventEmitter;
exports.emitter = new EventEmitter();

exports.capabilities = { 
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
		console.user(TAG, 'input', text);
		exports.emitter.emit('input', {
			data: data,
			params: {
				text: text
			}
		});
	})
	.catch((err) => {
		console.error(TAG, 'input', err);
		exports.emitter.emit('input', {
			data: data,
			error: err
		});
	});
};

exports.output = function({ data, params }) {
	console.ai(TAG, 'output', params);

	return new Promise((resolve, reject) => {
		if (params.error) {
			if (params.error.noStrategy) {
				LumenVox.play(no_strategy_responses.getRandom(), () => {
					resolve();
				});
			} else if (params.error.text) {		
				return LumenVox.play(params.error.text, () => {
					resolve();
				});	
			} else {
				return resolve();
			}
		}

		if (params.text) {
			return LumenVox.play(params.text, () => {
				resolve();
			});
		} 

		if (params.media) {
			const mopidy = require(__basedir + '/support/mopidy');

			if (params.media.artist) {
				mopidy.onReady(() => {
					mopidy.tracklist.clear()
					.then(() => { return mopidy.library.lookup(params.media.artist.uri); })
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

			if (params.media.track) {
				mopidy.onReady(() => {
					mopidy.tracklist.clear()
					.then(() => { return mopidy.library.lookup(params.media.track.uri); })
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

			if (params.media.action) {
				mopidy.playback[params.media.action](); 
				return resolve();
			}

			if (params.media.what) {
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

		if (params.lyrics) {
			return LumenVox.play(params.lyrics.lyrics_body.split("\n")[0], () => {
				resolve();
			});
		}

		return reject({ unkownOutputType: true });
	});
};