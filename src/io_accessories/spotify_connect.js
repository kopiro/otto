const Spotify = require('../lib/spotify');
const IOManager = require('../stdlib/iomanager');

function canHandleOutput(e, session) {
  if (session.settings.spotify == null) {
    return IOManager.CAN_HANDLE_OUTPUT.NO;
  }

  if (e.payload.music != null && e.payload.music.spotify) {
    return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
  }

  if (e.payload.media) {
    return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
  }

  return IOManager.CAN_HANDLE_OUTPUT.NO;
}

async function output(e, session) {
  const api = await Spotify.initWithSession(session);

  if (e.payload.music != null && e.payload.music.spotify != null) {
    if (e.payload.music.spotify.track != null) {
      await api.play({
        uris: [e.payload.music.spotify.track.uri],
      });
    } else if (e.payload.music.spotify.tracks != null) {
      await api.play({
        uris: e.payload.music.spotify.tracks.map(e => e.uri),
      });
    } else if (e.payload.music.spotify.artist != null) {
      await api.play({
        context_uri: e.payload.music.spotify.artist.uri,
      });
    } else if (e.payload.music.spotify.album != null) {
      await api.play({
        context_uri: e.payload.music.spotify.album.uri,
      });
    } else if (e.payload.music.spotify.playlist != null) {
      await api.play({
        context_uri: e.payload.music.spotify.playlist.uri,
      });
    }
  }

  if (e.payload.media != null && e.payload.media.action != null) {
    switch (e.payload.media.action) {
      case 'pause':
        await api.pause();
        break;
      case 'play':
        await api.play();
        break;
      case 'next':
        await api.skipToNext();
        break;
      case 'previous':
        await api.skipToPrevious();
        break;
      default:
    }
  }
}

function attach() {}

module.exports = {
  output,
  canHandleOutput,
  attach,
};
