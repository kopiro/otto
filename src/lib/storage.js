const _config = config.gcloud.storage;

const gcs = require('@google-cloud/storage')({
	keyFilename: __basedir + '/keys/gcloud.json'
});

module.exports = gcs.bucket(_config.bucket);