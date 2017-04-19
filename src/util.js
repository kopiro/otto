Array.prototype.getRandom = function() {
	return this[ _.random(0, this.length - 1) ];
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