const uuid = require('uuid');

global.uuid = function() {
	return uuid.v4();
};

Array.prototype.getRandom = function() {
	return this[ _.random(0, this.length - 1) ];
};

exports.mimicHumanMessage = function(text) {
	const splitted = text.split(/\.(?=\s+|[A-Z])/);
	let buffer = [];
	let el = '';
	for (var i = 0; i < splitted.length; i++) {
		const t = splitted[i];
		el += t + '. ';
		if (el.length > 200 || i == splitted.length - 1) {
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