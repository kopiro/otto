const TAG = 'Translator';

const $ = require('@google-cloud/translate')({
	keyFilename: __basedir + '/keys/gcloud.json'
});

exports.translate = function(text, to_language = config.language, from_language = config.language) {
	return new Promise((resolve, reject) => {
		if (to_language === from_language) {
			return resolve(text);
		}

		$.translate(text, to_language, (err, translation) => {
			if (err) return reject(err);
			resolve(translation);
		});
	});
};

exports.getLanguages = function(target = config.language) {
	return new Promise((resolve, reject) => {
		$.getLanguages(target, (err, languages) => {
			if (err) return reject(err);
			resolve(languages);
		});
	});
};