const TAG = 'IO.Kid';

const EventEmitter = require('events').EventEmitter;
exports.emitter = new EventEmitter();

exports.id = 'kid';
exports.capabilities = { 
	userCanViewUrls: false
};

const Rec = apprequire('rec');
const SpeechRecognizer = apprequire('speechrecognizer');
const Polly = apprequire('polly');
const Play = apprequire('play');

const sessionId = require('uuid').v4();

exports.getChats = function() {
	return Promise.resolve([]);
};

exports.getAlarmsAt = function() {
	return Promise.resolve([]);
};

exports.startInput = function(opt) {
	console.debug(TAG, 'startInput');

	opt = _.defaults(opt || {},  {
		listenSound: true
	});

	if (opt.listenSound == true) {
		Play.fileToSpeaker(__basedir + '/audio/startlisten.wav');
	}
	
	let data = {
		sessionId: sessionId
	};

	let rec_stream = Rec.start(_.extend({
		sampleRate: 16000,
		verbose: false,
		silence: true,
		time: 10
	}, config.recorder));

	SpeechRecognizer.recognizeAudioStream(rec_stream, false)
	.then((text) => {
		Rec.stop();
		process.stdout.write(
		"-------------------\n\n" + 
		text + "\n\n" + 
		"-------------------\n"
		);
		exports.emitter.emit('input', {
			data: data,
			params: {
				text: text
			}
		});
	})
	.catch((err) => {
		Rec.stop();
		console.error(TAG, 'input', err);
		exports.startInput({ listenSound: false });
	});
};

exports.output = function({ data, fulfillment:f }) {
	console.ai(TAG, 'output', data, f);
	f.data = f.data || {};

	return new Promise((resolve, reject) => {
		if (f.error) {
			if (f.error.speech) {	
				Polly.play(f.error.speech, resolve);
			} else {
				return resolve();
			}
		}

		if (f.speech) {
			return Polly.play(f.speech, f.data.speech).then(resolve);
		} 

		if (f.data.media) {
			const mopidy = apprequire('mopidy');

			if (f.data.media.artist) {
				mopidy.onReady(() => {
					mopidy.tracklist.clear()
					.then(() => { return mopidy.library.lookup(f.data.media.artist.uri); })
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

			if (f.data.media.track) {
				mopidy.onReady(() => {
					mopidy.tracklist.clear()
					.then(() => { return mopidy.library.lookup(f.data.media.track.uri); })
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

			if (f.data.media.action) {
				mopidy.playback[f.data.media.action](); 
				return resolve();
			}

			if (f.data.media.what) {
				mopidy.playback.setVolume(10)
				.then(() => { return mopidy.playback.getCurrentTrack(); })
				.then((track) => {
					const name = track.name;
					const artist = track.artists[0].name;
					return exports.output(data, { 
						speech: [
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

		if (f.data.lyrics) {
			return Polly.play(f.data.lyrics.lyrics_body.split("\n")[0]).then(resolve);
		}

		return reject({ unkownOutputType: true });
	});
};