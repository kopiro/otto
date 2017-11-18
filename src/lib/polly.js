const TAG = 'Polly';

const _ = require('underscore');
const md5 = require('md5');
const aws = apprequire('aws');
const fs = require('fs');

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

function setCacheForAudio(text, locale, file) {
	let key = md5(text + locale);
	cache.audio[key] = file;
	fs.writeFileSync(CACHE_REGISTRY_FILE, JSON.stringify(cache), () => {});
}

function getCacheForAudio(text, locale) {
	let key = md5(text + locale);
	const file = cache.audio[key];
	if (file != null && fs.existsSync(file)) {
		return file;
	}
}

function getVoice(opt) {
	return new Promise((resolve, reject) => {
		opt = opt || {};

		const locale = Util.getLocaleFromLanguageCode(opt.language);
		let voice = getCacheForVoice(locale);
		if (voice) {
			return resolve(voice);
		}

		pollyClient.describeVoices({
			LanguageCode: locale
		}, async(err, data) => {
			if (err && err.code === 'ValidationException') {
				console.debug(TAG, `falling back to locale ${config.locale} instead of ${locale}`, err);
				return getVoice(_.extend(config, { language: config.language }))
				.then(resolve)
				.catch(reject);
			}

			if (err) {
				console.error(TAG, err);
				return reject(err);
			}

			voice = data.Voices.find((v) => { 
				return v.Gender == opt.gender; 
			});

			if (voice == null) {
				console.debug(TAG, `falling back to locale ${config.locale} instead of ${locale}`);
				voice = await getVoice(_.extend(config, { language: config.language }));
				return resolve(voice);
			}

			setCacheForVoice(locale, voice);
			resolve(voice);
		});
	});
}

exports.getAudioFile = function(text, opt) {
	return new Promise(async(resolve, reject) => {
		opt = opt || {};

		opt = _.extend(config.polly || {}, {
			language: config.language,
			gender: 'Female'
		}, opt);

		const locale = Util.getLocaleFromLanguageCode(opt.language);

		let cached_file = getCacheForAudio(text, locale);
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

				setCacheForAudio(text, locale, cached_file);
				resolve(cached_file);
			});
		});

	});
};