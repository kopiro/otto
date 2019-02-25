const SpotifyWebApi = require('spotify-web-api-node');
const Server = require('../stdlib/server');
const Data = require('../data');
const config = require('../config');

const _config = config.spotify;
const $ = new SpotifyWebApi(_config);

if (config.serverMode) {
  $.setRedirectURI(Server.getAbsoluteURIByRelativeURI('/api/spotify'));
  Server.routerApi.get('/spotify', async (req, res) => {
    const data = await $.authorizationCodeGrant(req.query.code);
    const session = await Data.Session.findOne({ _id: req.query.state });
    if (session == null) {
      throw new Error('invalid_session');
    }

    await session.saveSettings({
      spotify: data.body,
    });

    res.end('OK');
  });
}

$.getAuthorizeUrl = function getAuthorizeUrl(session) {
  return $.createAuthorizeURL(
    [
      'user-read-birthdate',
      'user-read-email',
      'user-read-private',
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-top-read',
      'user-read-recently-played',
      'user-library-read',
      'user-read-currently-playing',
    ],
    session._id,
  );
};

$.initWithClientCredentials = async function initWithClientCredentials() {
  const api = new SpotifyWebApi(_config);
  const clientCredentials = await api.clientCredentialsGrant();
  api.setAccessToken(clientCredentials.body.access_token);
  return api;
};

$.initWithSession = async function initWithSession(session) {
  if (session.settings.spotify == null) {
    throw new Error('spotify_not_configured');
  }

  const api = new SpotifyWebApi(_config);
  api.setAccessToken(session.settings.spotify.access_token);
  api.setRefreshToken(session.settings.spotify.refresh_token);
  return api;
};

module.exports = $;
