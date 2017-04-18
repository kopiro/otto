const TAG = 'Translator';

const translate = require('@google-cloud/translate');
const client = translate({
	keyFilename: __basedir + '/keys/gcloud.json'
});

exports.translate = function(text, lang, callback) {
	console.debug(TAG, { text, lang });
	client.translate(text, lang, (err, translation) => {
		if (err) {
			console.error(TAG, err);
			return callback(err);
		}
		console.debug(TAG, translation);
		callback(null, translation);
	});
};

exports.getLanguages = function(target, callback) {
	console.debug(TAG, { target });
	client.getLanguages(target, (err, languages) => {
		if (err) {
			console.error(TAG, err);
			return callback(err);
		}
		console.debug(TAG, languages);
		callback(null, languages);
	});
};