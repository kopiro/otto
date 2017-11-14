const TAG = 'IO.Kid';

const _config = _.defaults(config.io.kid || {}, {
	waitForActivator: false
});

const EventEmitter = require('events').EventEmitter;
const emitter = new EventEmitter();

exports.id = 'kid';
exports.capabilities = { 
	userCanViewUrls: false
};

const Rec = apprequire('rec');
const SpeechRecognizer = apprequire('speechrecognizer');
const Polly = apprequire('polly');
const Play = apprequire('play');
const RaspiLeds = apprequire('raspi/leds');
const URLManager = apprequire('urlmanager');
const Mopidy = apprequire('mopidy');

function sendMessage(text, opt) {
	return new Promise((resolve, reject) => {
		async.eachSeries(Util.mimicHumanMessage(text), (t, next) => {
			Polly.getAudioFile(t, opt)
			.then((polly_file) => {
				Play.fileToSpeaker(polly_file, (err) => {
					if (err) return reject(err);
					next();
				});
			})
			.catch(reject);
		}, resolve);
	});
}

exports.startInput = function() {
	console.debug(TAG, 'startInput');

	IOManager.registerSession(clientId, exports.id, { platform: process.platform })
	.then((session_model) => {

		emitter.emit('input.start', {
			session_model: session_model,
		});
		
		let rec_stream = Rec.start(_.extend({
			sampleRate: 16000,
			verbose: false,
			silence: true,
			time: 10
		}, config.recorder));

		SpeechRecognizer.recognizeAudioStream(rec_stream, {
			language: session_model.translate_from
		})
		.then((text) => {

			Rec.stop();
			IOManager.writeLogForSession(session_model.id, text);

			if (_config.waitForActivator) {
				if (false === AI_NAME_ACTIVATOR.test(text)) {
					console.info(TAG, 'skipping input for missing activator', text);
					exports.startInput({ listenSound: false });
					return;
				}
			}

			emitter.emit('input', {
				session_model: session_model,
				params: {
					text: text
				}
			});

		})
		.catch((err) => {
			console.error(TAG, 'input', err);
			Rec.stop();
			exports.startInput();
		});

	})
	.catch((session_model) => {
		emitter.emit('input', {
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
		const language = f.data.language || session_model.translate_to || config.language;

		if (f.data.error) {
			if (f.data.error.speech) {	
				sendMessage(f.data.error.speech, {
					language: language
				})
				.then(resolve)
				.catch(reject);
			} else {
				return resolve();
			}
		}

		if (f.data.url) {
			URLManager.open(f.data.url);
		}

		if (f.speech) {
			return sendMessage(f.speech, {
				language: language
			})
			.then(resolve)
			.catch(reject);
		} 

		if (f.data.media != null) {

			if (f.data.media.artist) {
				Mopidy.onReady(() => {
					Mopidy.tracklist.clear()
					.then(() => { return Mopidy.library.lookup(f.data.media.artist.uri); })
					.then((tracks) => { return Mopidy.tracklist.add(tracks); })
					.then((ttlTracks) => {
						Mopidy.tracklist.shuffle();
						return Mopidy.playback.play(ttlTracks[0]);
					})
					.catch((err) => {
						console.error(TAG, err);
					});
				});
				return resolve();
			}

			if (f.data.media.track) {
				Mopidy.onReady(() => {
					Mopidy.tracklist.clear()
					.then(() => { return Mopidy.library.lookup(f.data.media.track.uri); })
					.then((tracks) => { return Mopidy.tracklist.add(tracks); })
					.then((ttlTracks) => {
						return Mopidy.playback.play(ttlTracks[0]);
					})
					.catch((err) => {
						console.error(TAG, err);
					});
				});
				return resolve();
			}

			if (f.data.media.action) {
				Mopidy.playback[f.data.media.action](); 
				return resolve();
			}

			if (f.data.media.what) {
				Mopidy.playback.setVolume(10)
				.then(() => { return Mopidy.playback.getCurrentTrack(); })
				.then((track) => {
					const name = track.name;
					const artist = track.artists[0].name;
					return IOManager.output({ 
						speech: [
						`Questa canzone si chiama ${name} di ${artist}`,
						`Bella questa! É ${name} di ${artist}!`,
						`Come fai a non conoscerla? Si tratta di ${name} di ${artist}`
						].getRandom()
					}, session_model);
				})
				.catch(reject)
				.then(() => {
					Mopidy.playback.setVolume(100)
					.then(resolve);
				});
				return;
			}

		}

		if (f.data.lyrics) {
			const speech = f.data.lyrics.lyrics_body.split("\n")[0];
			return sendMessage(speech).then(resolve);
		}

		return reject({ unkownOutputType: true });
	});
};

/////////////////////
// Setup RaspiLeds //
/////////////////////

emitter.on('input.start', () => {
	RaspiLeds.off();
});

emitter.on('input', () => {
	RaspiLeds.setColor([ 0,255,0 ]);
});
