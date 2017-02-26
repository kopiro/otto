const TAG = 'TRANSLATOR';

const translate = require('@google-cloud/translate');
const translateClient = translate({
	keyFilename: __basedir + '/gcloud.json'
});

exports.translate = function(text, lang, callback) {
	console.debug(TAG, text, lang);
	translateClient.translate(text, lang, callback);
};