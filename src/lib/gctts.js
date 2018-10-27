const TAG = 'GCTTS';

const _ = require('underscore');
const md5 = require('md5');
const fs = require('fs');

const _config = config.gctts;
const CACHE_REGISTRY_FILE = __cachedir + '/' + TAG + '.json';

// Creates a client
const GCTTS = require('@google-cloud/text-to-speech');
const client = new GCTTS.TextToSpeechClient({
	options: {
		keyFilename: __basedir + '/keys/gcloud.json'
	}
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
async function getVoice(opt) {
	const locale = getLocaleFromLanguageCode(opt.language);
	return {
		languageCode: locale,
		name: locale + '-Wavenet-A',
		ssmlGender: opt.gender
	};
}

/**
 * Download the audio file for that sentence and options
 * @param {String} text	Sentence
 * @param {Object} opt
 */
exports.getAudioFile = function (text, opt = {}) {
	return new Promise(async (resolve, reject) => {
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

		const input = {};
		if (isSSML) input.ssml = text;
		else input.text = text;

		// Call the API
		client.synthesizeSpeech({
			input: input,
			voice: voice,
			audioConfig: {
				audioEncoding: 'MP3'
			}
		}, (err, data) => {
			if (err) {
				return reject(err);
			}

			file = __cachedir + '/' + TAG + '_' + uuid() + '.mp3';
			fs.writeFile(file, data.audioContent, 'binary', (err) => {
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