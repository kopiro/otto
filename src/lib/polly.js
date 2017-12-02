const TAG = 'Polly';

const _ = require('underscore');
const md5 = require('md5');
const aws = apprequire('aws');
const fs = require('fs');

const _config = config.polly;

const pollyClient = new aws.Polly({
	signatureVersion: 'v4',
	region: 'eu-west-1'
});

const CACHE_REGISTRY_FILE = __cachedir + '/polly.json';

let cache = null;
try { 
	cache = JSON.parse(fs.readFileSync(CACHE_REGISTRY_FILE).toString());
	if (cache.audio == null) throw 'Invalid format'; 
} catch (ex) { 
	cache = {
		audio: {},
		voices: {}
	};
}

function setCacheForVoice(locale, voice) {
	cache.voices[locale] = voice;
	fs.writeFileSync(CACHE_REGISTRY_FILE, JSON.stringify(cache), () => {});
}

function getCacheForVoice(locale) {
	return cache.voices[locale];
}

function setCacheForAudio(text, language, file) {
	let key = md5(text + language);
	cache.audio[key] = file;
	fs.writeFileSync(CACHE_REGISTRY_FILE, JSON.stringify(cache), () => {});
}

function getCacheForAudio(text, language) {
	let key = md5(text + language);
	const file = cache.audio[key];
	if (file != null && fs.existsSync(file)) {
		return file;
	}
}

function getVoice(opt = {}) {
	return new Promise((resolve, reject) => {
		_.defaults(opt, {
			language: config.language
		});

		const locale = getLocaleFromLanguageCode(opt.language);
		let voice = getCacheForVoice(locale);
		if (voice) {
			return resolve(voice);
		}

		pollyClient.describeVoices({
			LanguageCode: locale
		}, async(err, data) => {
			if (err != null) {
				if (err.code !== 'ValidationException') {
					console.error(TAG, err);
					return reject(err);
				}
			}

			voice = data.Voices.find((v) => { 
				return v.Gender == opt.gender; 
			});

			if (voice == null) {
				console.debug(TAG, `falling back to language ${config.language} instead of ${opt.language}`);
				voice = await getVoice(_.extend({}, opt, { language: config.language }));
				return resolve(voice);
			}

			setCacheForVoice(locale, voice);
			return resolve(voice);
		});
	});
}

exports.getAudioFile = function(text, opt = {}) {
	return new Promise(async(resolve, reject) => {
		_.defaults(opt, {
			gender: _config.gender,
			language: config.language
		});

		let cached_file = getCacheForAudio(text, opt.language);
		if (cached_file) {
			console.debug(TAG, cached_file, '(cached)');
			return resolve(cached_file);
		}

		console.debug(TAG, 'request', { text, opt });

		let voice = await getVoice(opt);
		pollyClient.synthesizeSpeech({
			VoiceId: voice.Id,
			Text: text,
			OutputFormat: 'mp3',
		}, (err, data) => {
			if (err) {
				console.error(TAG, err);
				return reject(err);
			}

			cached_file = __cachedir + '/polly_' + uuid() + '.mp3';
			fs.writeFile(cached_file, data.AudioStream, function(err) {
				if (err) {
					console.error(TAG, err);
					return reject(err);
				}

				setCacheForAudio(text, opt.language, cached_file);
				resolve(cached_file);
			});
		});

	});
};