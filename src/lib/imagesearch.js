const TAG = 'ImageSearch';
const _config = config.gcloud;
const ImagesClient = require('google-images');

module.exports = new ImagesClient(_config.cseId, _config.apiKey);
