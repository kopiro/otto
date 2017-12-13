const TAG = 'Translator';

const translate = require('@google-cloud/translate');
const translateClient = translate({
	keyFilename: __basedir + '/keys/gcloud.json'
});

exports.translate = function(text, to_language = config.language, from_language = config.language) {
	return new Promise((resolve, reject) => {
		
		console.debug(TAG, { text, to_language, from_language });

		if (to_language === from_language) {
			return resolve(text);
		}

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
			
			resolve(languages);
		});
	});
};