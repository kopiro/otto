const uuid = require('uuid');
const _ = require('underscore');
const diacriticsRemove = require('diacritics').remove;

global.requireOrNull = function(e) {
	try { return require(e); } 
	catch (ex) { return null; }
};

global.rand = function(e) {
	return _.isArray(e) ? e[_.random(0, e.length - 1)] : e;
};

// Define a new require to require files from our path
global.apprequire = function(k) {
	return require(__basedir + '/src/lib/' + k);
};

global.timeout = function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

global.uuid = function() {
	return uuid.v4();
};

global.cleanText = function(t) {
	return diacriticsRemove(t).toLowerCase();
};

global.mimicHumanMessage = function(text) {
	const splitted = text.split(/\\n|\n|\.(?=\s+|[A-Z])/);
	return _.compact(splitted);
};

global.helperrequire = function(k) {
	return require(__basedir + '/src/helpers/' + k);
};

/*
Valid Values: cy-GB | da-DK | de-DE | en-AU | en-GB | en-GB-WLS | en-IN | en-US | es-ES | es-US | fr-CA | fr-FR | is-IS | it-IT | ja-JP | nb-NO | nl-NL | pl-PL | pt-BR | pt-PT | ro-RO | ru-RU | sv-SE | tr-TR
 */
global.getLocaleFromLanguageCode = function(language) {
	if (_.isEmpty(language)) return config.locale;
	switch (language) {
		case 'de': return 'de-DE';
		case 'da': return 'da-DK';
		case 'it': return 'it-IT';
		case 'is': return 'is-IS';
		case 'fr': return 'fr-FR';
		case 'es': return 'es-ES';
		case 'tr': return 'tr-TR';
		case 'ru': return 'ru-RU';
		case 'ro': return 'ro-RO';
		case 'en': return 'en-GB';
		case 'ja': return 'ja-JP';
		case 'cy': return 'cy-GB';
		case 'pt': return 'pt-PT';
		case 'nl': return 'nl-NL';
		case 'nb': return 'nb-NO';
		case 'sv': return 'sv-SE';
		default: return config.locale;
	}
};