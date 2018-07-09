const TAG = 'Spotify';

const _config = config.spotify;

const SpotifyWebApi = require('spotify-web-api-node');
const SpotifyWAT = require('spotify-webplayer-accesstoken');

const client = new SpotifyWebApi(_config);

client.getCredentialsForChromecast = async function() {
	SpotifyWAT.setInitialCookies(_config.cookies);
	return SpotifyWAT.getCredentials();
};

client.connect = async function() {
	const e = await client.clientCredentialsGrant();
	client.setAccessToken(e.body.access_token);
};

module.exports = client;