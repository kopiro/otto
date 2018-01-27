const TAG = 'Spotify';

const _config = config.spotify;
const SpotifyWebApi = require('spotify-web-api-node');

const client = new SpotifyWebApi(_config);

module.exports = client;