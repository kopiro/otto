const TAG = 'Polly';

const aws = require('aws-sdk');
aws.config.loadFromPath(__dirname + '/keys/aws.json');

const fs = require('fs');
const md5 = require('md5');

const Play = require(__basedir + '/support/play');

// Create an Polly client
const Polly = new aws.Polly({
	signatureVersion: 'v4',
	region: 'eu-west-1'
});

const CACHE_FILE = __cachedir + '/polly.json';
let cache = null;
try { cache = require(CACHE_FILE); } 
catch (ex) { cache = {}; }

let locale_to_voice = {};

function setCache(text, voice, file) {
	cache[ md5(text + voice) ] = file;
	fs.writeFile(CACHE_FILE, JSON.stringify(cache), () => {});
}

function getCache(text, voice) {
	const file = cache[ md5(text + voice) ];
	if (file != null && fs.existsSync(file)) return file;
}

function getVoice(opt) {
	return new Promise((resolve, reject) => {

		const locale = Util.getLocaleFromLanguageCode(opt.language);

		if (locale_to_voice[locale]) {
			resolve(locale_to_voice[locale]);
		} else {
			Polly.describeVoices({
				LanguageCode: locale
			}, (err, data) => {
				if (err && err.code === 'ValidationException') {
					console.debug(TAG, `falling back to locale ${config.locale} instead of ${locale}`);
					return getVoice(_.extend(config, { language: config.language }))
					.then(resolve)
					.catch(reject);
				}

				if (err) {
					console.error(TAG, err);
					reject(err);
				}

				console.debug(TAG, 'available voices', data);
				const voice = data.Voices.find((v) => { return v.Gender == opt.gender; });

				if (voice == null) {
					console.debug(TAG, `falling back to locale ${config.locale} instead of ${locale}`);
					return getVoice(_.extend(config, { language: config.language }))
					.then(resolve)
					.catch(reject);
				}

				locale_to_voice[locale] = voice; // cache voice id
				resolve(voice);
			});
		}
	});
}

exports.download = function(text, opt) {
	return new Promise((resolve, reject) => {
		text = text.trim();
		opt = opt || {};

		opt = _.extend(config.polly, {
			language: config.language
		}, opt);

		console.debug(TAG, 'request', { text, opt });

		const locale = Util.getLocaleFromLanguageCode(opt.language);

		let cached_file = getCache(text, locale);
		if (cached_file) {
			console.debug(TAG, cached_file, '(cached)');
			resolve(cached_file);
			return;
		}
		
		getVoice(opt)
		.then((voice) => {
			Polly.synthesizeSpeech({
				VoiceId: voice.Id,
				Text: text,
				OutputFormat: 'mp3',
			}, (err, data) => {
				if (err) {
					console.error(TAG, err);
					return reject(err);
				}

				const cached_audio_file = __cachedir + '/polly_' + require('uuid').v4() + '.mp3';
				fs.writeFile(cached_audio_file, data.AudioStream, function(err) {
					if (err) {
						console.error(TAG, err);
						return reject(err);
					}

					console.debug(TAG, cached_audio_file);

					setCache(text, voice, cached_audio_file);
					resolve(cached_audio_file);
				});
			});
		})
		.catch(reject);

	});
};

exports.play = function(text, opt) {
	return new Promise((resolve, reject) => {
		exports.download(text, opt)
		.then((polly_file) => {
			Play.fileToSpeaker(polly_file, (err) => {
				if (err) return reject(err);
				resolve();
			});
		})
		.catch(reject);
	});
};

exports.playToFile = function(text, file, opt) {
	return new Promise((resolve, reject) => {
		exports.download(text, opt)
		.then((polly_file) => {
			Play.fileToFile(polly_file, file, (err) => {
				if (err) return reject(err);
				resolve();
			});
		})
		.catch(reject);
	});
};

exports.playToTmpFile = function(text, opt) {
	return new Promise((resolve, reject) => {
		exports.download(text, opt)
		.then((polly_file) => {
			Play.fileToTmpFile(polly_file, (err) => {
				if (err) return reject(err);
				resolve();
			});
		})
		.catch(reject);
	});
};