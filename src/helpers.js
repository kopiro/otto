const uuid = require('uuid');
const _ = require('underscore');
const diacriticsRemove = require('diacritics').remove;

global.requireOrNull = function(e) {
	try { return require(e); } 
	catch (ex) { return null; }
};

Array.prototype.getRandom = function() {
	return this[ _.random(0, this.length - 1) ];
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
	const splitted = text.split(/\.(?=\s+|[A-Z])/);
	return _.compact(splitted);
};

global.getLocaleFromLanguageCode = function(language) {
	if (_.isEmpty(language)) return config.locale;
	switch (language) {
		case 'en': return 'en-US';
		case 'ja': return 'ja-JP';
		default: return language + '-' + language.toUpperCase();
	}
};