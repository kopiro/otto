const $ = require('@google-cloud/vision')({
	keyFilename: __basedir + '/keys/gcloud.json'
});
module.exports = $;