const ImagesClient = require("google-images");
const config = require("../config");

const _config = config.gcloud;

module.exports = new ImagesClient(_config.cseId, _config.apiKey);
