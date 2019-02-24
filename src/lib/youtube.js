const YouTube = require('simple-youtube-api');

const _config = config.youtube;

module.exports = new YouTube(_config.apiKey);
