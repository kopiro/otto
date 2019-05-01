const gcloudStorage = require('@google-cloud/storage')();
const config = require('../config');

const _config = config.gcloud.storage;

module.exports = gcloudStorage.bucket(_config.bucket);
