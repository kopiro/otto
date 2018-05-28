const TAG = 'Spotify';

const _config = config.spotify;

const SpotifyWebApi = require('spotify-web-api-node');

const client = new SpotifyWebApi(_config);

// const SpotifyWPAT = require('spotify-webplayer-accesstoken');
// client.connect = async function() {
// 	const access_token = await SpotifyWPAT.getAccessToken(_config.username, _config.password);
// 	client.setAccessToken(access_token);
// 	client.connected = true;
// };

client.connect = async function() {
	const e = await client.clientCredentialsGrant();
	client.setAccessToken(e.body.access_token);
};

module.exports = client;