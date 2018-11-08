const TAG = 'Spotify';

const _config = config.spotify;

const SpotifyWebApi = require('spotify-web-api-node');
const SpotifyWAT = require('spotify-webplayer-accesstoken');

const $ = new SpotifyWebApi(_config);

$.getCredentialsForChromecast = async function() {
	SpotifyWAT.setInitialCookies(_config.cookies);
	return SpotifyWAT.getCredentials();
};

$.connect = $.init = async function() {
	const e = await $.clientCredentialsGrant();
	$.setAccessToken(e.body.access_token);
};

module.exports = $;
