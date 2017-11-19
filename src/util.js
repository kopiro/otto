const uuid = require('uuid');
const _ = require('underscore');
const diacriticsRemove = require('diacritics').remove;

global.timeout = function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

global.uuid = function() {
	return uuid.v4();
};

global.cleanText = function(t) {
	return diacriticsRemove(t).toLowerCase();
};

Array.prototype.getRandom = function() {
	return this[ _.random(0, this.length - 1) ];
};

exports.mimicHumanMessage = function(text) {
	text = text.replace(/\.[a-z]/gi, '. ');
	const splitted = text.split(/\.(?=\s+|[A-Z])|\n/);
	let buffer = [];
	let el = '';
	for (var i = 0; i < splitted.length; i++) {
		const t = splitted[i];
		const last = (i == splitted.length - 1);
		el += t + (last ? '' : '.');
		if (el.length > 200 || last) {
			buffer.push(el);
			el = '';
		}
	}
	return buffer;
};

exports.getLocaleFromLanguageCode = function(language) {
	if (_.isEmpty(language)) return config.locale;
	switch (language) {
		case 'en':
		return 'en-US';
		case 'ja':
		return 'ja-JP';
		default:
		return language + '-' + language.toUpperCase();
	}
};