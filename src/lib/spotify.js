const TAG = 'Spotify';

const _config = config.spotify;
const SpotifyWebApi = require('spotify-web-api-node');

const client = new SpotifyWebApi(_config);

client.connect = async function() {
	if (client._connected) return client;

	const data = await client.clientCredentialsGrant();
	console.debug(TAG, 'connection success', data.body);
	
	client.setAccessToken(data.body['access_token']);
	client._connected = true;
	return client;
};

module.exports = client;