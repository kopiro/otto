const TAG = 'Polly';

const aws = require('aws-sdk');
const fs = require('fs');

const play = require(__basedir + '/support/play');

// Create an Polly client
const Polly = new aws.Polly({
	signatureVersion: 'v4',
	region: 'eu-west-1'
});

const CACHE_FILE = __cachedir + '/polly.json';
let cache = null;
try { cache = require(CACHE_FILE); } 
catch (ex) { cache = {}; }

function setCache(text, file) {
	cache[text] = file;
	fs.writeFile(CACHE_FILE, JSON.stringify(cache), () => {});
}

exports.download = function(text, callback) {
	text = text.trim();
	if (cache[text] && fs.existsSync(cache[text])) {
		console.debug(TAG, cache[text], '(cached)');
		callback(null, cache[text]);
	} else {
		Polly.synthesizeSpeech({
			Text: text,
			OutputFormat: 'mp3',
			VoiceId: 'Carla'
		}, (err, data) => {
			if (err) {
				console.error(TAG, err);
				return callback(err);
			}

			const cached_audio_file = __cachedir + '/polly_' + require('uuid').v4() + '.mp3';
			fs.writeFile(cached_audio_file, data.AudioStream, function(err) {
				if (err) {
					console.error(TAG, err);
					return callback(err);
				}

				console.debug(TAG, cached_audio_file);

				setCache(text, cached_audio_file);
				callback(null, cached_audio_file);
			});
		});
	}
};

exports.play = function(text, callback) {
	exports.download(text, (err, file) => {
		if (err) {
			return callback(err);
		}

		play.fileToSpeaker(file, (err) => {
			if (err) {
				return callback(err);
			}

			callback(null);
		});
	});
};

exports.playToFile = function(text, file, callback) {
	exports.download(text, (err, polly_file) => {
		if (err) return callback(err);
		play.fileToFile(polly_file, file, (err) => {
			if (err) return callback(err);
			callback(null);
		});
	});
};

exports.playToTmpFile = function(text, callback) {
	exports.download(text, (err, polly_file) => {
		if (err) {
			return callback(err);
		}

		play.fileToTmpFile(polly_file, (err) => {
			if (err) {
				return callback(err);
			}

			callback(null);
		});
	});
};