const TAG = 'TRANSLATOR';

const translate = require('@google-cloud/translate');
const translateClient = translate({
	keyFilename: __basedir + '/gcloud.json'
});

exports.translate = translateClient.translate;