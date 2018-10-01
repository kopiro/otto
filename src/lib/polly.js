const TAG = 'Polly';

const _ = require('underscore');
const md5 = require('md5');
const aws = apprequire('aws');
const fs = require('fs');

const _config = config.polly;
const CACHE_REGISTRY_FILE = __cachedir + '/polly.json';

const pollyClient = new aws.Polly({
	signatureVersion: 'v4',
	region: 'eu-west-1'
});

let cache = {
	audio: {},
	voices: {}
};

/**
 * Load the cache registry from file
 */
function loadCacheRegistry() {
	try { 
		let registry = JSON.parse(fs.readFileSync(CACHE_REGISTRY_FILE).toString());
		if (registry.audio == null || registry.voices == null) throw 'Invalid format'; 
		cache = registry;
	} catch (ex) {}
}

/**
 * Set the cache item for the voice
 * @param {Object} opt
 * @param {String} voice
 */
async function setCacheForVoice(opt, voice) {
	return new Promise((resolve) => {
		cache.voices[JSON.stringify(opt)] = voice;
		fs.writeFile(CACHE_REGISTRY_FILE, JSON.stringify(cache), resolve);
	});
}

/**
 * Get the cache for a voice
 * @param {Object} opt 
 */
function getCacheForVoice(opt) {
	return cache.voices[JSON.stringify(opt)];
}

/**
 * Set the cache item for the audio
 * @param {String} text	The spoken text
 * @param {Object} opt	
 * @param {String} file File containing the audio
 */
async function setCacheForAudio(text, opt, file) {
	return new Promise((resolve) => {
		let key = md5(text + JSON.stringify(opt));
		cache.audio[key] = file;
		fs.writeFile(CACHE_REGISTRY_FILE, JSON.stringify(cache), resolve);
	});
}

/**
 * Get the cache item for an audio
 * @param {String} text 
 * @param {Object} opt 
 * @returns {String} The file containing the audio
 */
function getCacheForAudio(text, opt) {
	let key = md5(text + JSON.stringify(opt));
	const file = cache.audio[key];
	if (file != null && fs.existsSync(file)) {
		return file;
	}
}

/**
 * Retrieve the voice title based on language and gender
 * @param {*} opt 
 */
function getVoice(opt) {
	return new Promise((resolve, reject) => {
		const locale = getLocaleFromLanguageCode(opt.language);
		let voice = getCacheForVoice(opt);
		if (voice) {
			return resolve(voice);
		}

		// Call the API to retrieve all voices in that locale
		pollyClient.describeVoices({
			LanguageCode: locale
		}, async(err, data) => {
			if (err != null) {
				return reject(err);
			}

			// Filter voice by selected gender
			voice = data.Voices.find(v => (v.Gender == opt.gender));

			if (voice == null) {
				console.debug(TAG, `falling back to language ${config.language} instead of ${opt.language}`);
				voice = await getVoice(_.extend({}, opt, { language: config.language }));
				return resolve(voice);
			}

			// Save for later uses
			setCacheForVoice(opt, voice);
			return resolve(voice);
		});
	});
}

/**
 * Download the audio file for that sentence and options
 * @param {String} text	Sentence
 * @param {Object} opt
 */
exports.getAudioFile = function(text, opt = {}) {
	return new Promise(async(resolve, reject) => {
		_.defaults(opt, {
			gender: _config.gender,
			language: config.language
		});

		// If file has been downloaded, just serve it
		let file = getCacheForAudio(text, opt);
		if (file) {
			return resolve(file);
		}

		// Find the voice title by options
		let voice = await getVoice(opt);
		const isSSML = /<speak>/.test(text);

		// Call the API
		pollyClient.synthesizeSpeech({
			VoiceId: voice.Id,
			Text: text,
			TextType: isSSML ? 'ssml' : 'text',
			OutputFormat: 'mp3',
		}, (err, data) => {
			if (err) {
				return reject(err);
			}

			file = __cachedir + '/polly_' + uuid() + '.mp3';
			fs.writeFile(file, data.AudioStream, (err) => {
				if (err) {
					return reject(err);
				}

				// Save this entry onto cache
				setCacheForAudio(text, opt, file);
				resolve(file);
			});
		});

	});
};

loadCacheRegistry();