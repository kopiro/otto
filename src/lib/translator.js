const TAG = 'Translator';

const translate = require('@google-cloud/translate');
const translateClient = translate({
	keyFilename: __basedir + '/keys/gcloud.json'
});

exports.translate = function(text, to_language = config.language, from_language = null) {
	return new Promise((resolve, reject) => {
		
		if (from_language != null && to_language === from_language) {
			console.debug(TAG, 'do not translate');
			return resolve(text);
		}

		console.debug(TAG, { text, to_language });
		translateClient.translate(text, to_language, (err, translation) => {
			if (err) {
				console.error(TAG, err);
				return reject(err);
			}

			console.debug(TAG, { translation });
			resolve(translation);
		});
	});
};

exports.getLanguages = function(target = config.language) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, { target });
		translateClient.getLanguages(target, (err, languages) => {
			if (err) {
				console.error(TAG, err);
				return reject(err);
			}
			
			console.debug(TAG, { languages });
			resolve(languages);
		});
	});
};