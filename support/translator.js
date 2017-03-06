const TAG = 'Translatore';

const translate = require('@google-cloud/translate');
const translateClient = translate({
	keyFilename: __basedir + '/keys/gcloud.json'
});

exports.translate = function(text, lang, callback) {
	console.debug(TAG, text, lang);
	translateClient.translate(text, lang, callback);
};