const _config = config.gcloud.storage;

const gcs = require('@google-cloud/storage')();

module.exports = gcs.bucket(_config.bucket);
