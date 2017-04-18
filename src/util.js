Array.prototype.getRandom = function() {
	return this[ _.random(0, this.length - 1) ];
};

exports.getStringFromLanguageCode = function(code) {
	const languages = JSON.parse(fs.readFileSync(__basedir + '/etc/languages.json'));
	return languages[ code || config.language ];
};

exports.getLocaleFromString = function(lang_str) {
	const languages = JSON.parse(fs.readFileSync(__basedir + '/etc/languages.json'));
	let lang = null;

	for (let lang_iso in languages) {
		if (languages.hasOwnProperty(lang_iso)) {
			if (languages[lang_iso] != null) {
				if (languages[lang_iso].toLowerCase() == lang_str.toLowerCase()) {
					return lang_iso;
				}
			}
		}
	}

	return config.language;
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