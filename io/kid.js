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

const sessionId = config.io.kid.sessionId || require('node-uuid').v4();

function registerSession(sessionId, data) {
	return new Promise((resolve, reject) => {
		new Memory.Session({ id: sessionId })
		.fetch({ require: true })
		.then((session_model) => {
			if (!session_model.get('approved')) return reject(session_model);
			resolve(session_model);
		})
		.catch((err) => {
			let session_model = new Memory.Session({ 
				id: sessionId,
				io_id: exports.id,
				io_data: JSON.stringify(data)
			}).save(null, { method: 'insert' });
			reject(session_model);
		});
	});
}

exports.getChats = function() {
	return Promise.resolve([]);
};

exports.getAlarmsAt = function() {
	return Promise.resolve([]);
};

exports.startInput = function(opt) {
	console.debug(TAG, 'startInput');

	registerSession(sessionId, process.platform)
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
			process.stdout.write(
			"-------------------\n\n" + 
			text + "\n\n" + 
			"-------------------\n"
			);
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
	console.ai(TAG, 'output', session_model.id, f);

	return new Promise((resolve, reject) => {
		if (f.error) {
			if (f.error.speech) {	
				Polly.play(f.error.speech, {
					language: session_model.get('translate_to')
				}).then(resolve);
			} else {
				return resolve();
			}
		}

		const lang = f.data.speech || session_model.get('translate_to');

		if (f.speech) {
			return Polly.play(f.speech, {
				language: session_model.get('translate_to')
			}).then(resolve);
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