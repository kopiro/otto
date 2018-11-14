const TAG = 'Spotify';

const _config = config.spotify;

const spotifyWebApi = require('spotify-web-api-node');
const spotifyWebPlayerAccessToken = require('spotify-webplayer-accesstoken');

const $ = new spotifyWebApi(_config);

const server = requireLibrary('server');

if (config.serverMode) {
	$.setRedirectURI(server.getAbsoluteURIByRelativeURI('/api/spotify'));
	server.routerApi.get('/spotify', async (req, res) => {
		const data = await $.authorizationCodeGrant(req.query.code);
		const session = await Data.Session.findOne({ _id: req.query.state });
		if (session == null) throw 'invalid_session';

		await session.saveSettings({
			spotify: data.body
		});

		res.end('OK');
	});
}

$.getAuthorizeUrl = function(session) {
	return $.createAuthorizeURL(
		[
			'user-read-birthdate',
			'user-read-email',
			'user-read-private',
			'user-modify-playback-state'
		],
		session._id
	);
};

$.initWithClientCredentials = async function() {
	const api = new spotifyWebApi(_config);
	const e = await api.clientCredentialsGrant();
	api.setAccessToken(e.body.access_token);
	return api;
};

$.initWithSession = async function(session) {
	if (session.settings.spotify == null) throw 'spotify_not_configured';
	const api = new spotifyWebApi(_config);
	api.setAccessToken(session.settings.spotify.access_token);
	api.setRefreshToken(session.settings.spotify.refresh_token);
	return api;
};

module.exports = $;
