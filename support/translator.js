const TAG = 'Translator';

const translate = require('@google-cloud/translate');
const translateClient = translate({
	keyFilename: __basedir + '/keys/gcloud.json'
});

exports.translate = function(text, lang, callback) {
	console.debug(TAG, 'input', { text, lang });
	translateClient.translate(text, lang, (err, text) => {
		if (err) {
			console.error(TAG, err);
			return callback(err);
		}
		
		console.debug(TAG, 'output', { text });
		callback(err, text);
	});
};