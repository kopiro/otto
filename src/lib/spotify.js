const TAG = 'Spotify';

const _config = config.spotify;

const SpotifyWebApi = require('spotify-web-api-node');
const SpotifyWPAT = require('spotify-webplayer-accesstoken');

const client = new SpotifyWebApi();

client.connect = async function() {
	if (client.connected == null) {
		const access_token = await SpotifyWPAT.getAccessToken(_config.username, _config.password);
		client.setAccessToken(access_token);
		client.connected = true;
	}
};

module.exports = client;