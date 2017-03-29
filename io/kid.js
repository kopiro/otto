const TAG = 'IO.Kid';
const IOManager = require(__basedir + '/iomanager');

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

const sessionId = config.io.kid.sessionId || require('node-uuid').v4();

exports.startInput = function(opt) {
	console.debug(TAG, 'startInput');

	IOManager.registerSession(sessionId, exports.id, process.platform)
	.then((session_model) => {

		opt = _.defaults(opt || {},  {
			listenSound: true
		});

		if (opt.listenSound == true) {
			Play.fileToSpeaker(__basedir + '/audio/startlisten.wav');
		}
		
		let rec_stream = Rec.start(_.extend({
			sampleRate: 16000,
			verbose: false,
			silence: true,
			time: 10
		}, config.recorder));

		SpeechRecognizer.recognizeAudioStream(rec_stream, {
			must_convert: false,
			language: session_model.get('translate_from')
		})
		.then((text) => {

			Rec.stop();

			IOManager.writeLogForSession(session_model.id, text);
		
			exports.emitter.emit('input', {
				session_model: session_model,
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

	})
	.catch((session_model) => {
		exports.emitter.emit('input', {
			session_model: session_model,
			error: {
				unauthorized: true
			}
		});
	});
};

exports.output = function(f, session_model) {
	console.info(TAG, 'output', session_model.id, f);

	return new Promise((resolve, reject) => {
		const language = f.data.language || session_model.get('translate_to');

		if (f.data.error) {
			if (f.data.error.speech) {	
				Polly.play(f.data.error.speech, {
					language: language
				}).then(resolve);
			} else {
				return resolve();
			}
		}

		if (f.speech) {
			return Polly.play(f.speech, {
				language: language
			}).then(resolve);
		} 

		if (f.data.media != null) {
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
			const speech = f.data.lyrics.lyrics_body.split("\n")[0];
			return Polly.play(speech).then(resolve);
		}

		return reject({ unkownOutputType: true });
	});
};