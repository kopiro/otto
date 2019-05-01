exports.id = 'music.play';

const spotify = require('../../lib/spotify');

module.exports = async function main({ queryResult }, session) {
  const { parameters: p } = queryResult;

  const api = await spotify.initWithSession(session);

  if (p.myLibrary) {
    const data = await api.getMySavedTracks({
      limit: 10,
    });
    console.log(data);
    const { items } = data.body;
    if (items.length === 0) throw 'not_found';

    return {
      payload: {
        music: {
          spotify: {
            tracks: items.map(e => e.track),
          },
        },
      },
    };
  }

  if (p.track) {
    const data = await api.searchTracks(`${p.track} ${p.artist}`);
    const { items } = data.body.tracks;
    if (items.length === 0) throw 'not_found';

    return {
      payload: {
        music: {
          spotify: {
            track: items[0],
          },
        },
      },
    };
  }

  if (p.artist) {
    const data = await api.searchArtists(p.artist);
    const { items } = data.body.artists;
    if (items.length === 0) throw 'not_found';

    return {
      payload: {
        music: {
          spotify: {
            artist: items[0],
          },
        },
      },
    };
  }

  if (p.playlist) {
    const data = await api.searchPlaylists(p.playlist);
    const { items } = data.body.playlists;
    if (items.length === 0) throw 'not_found';

    return {
      payload: {
        music: {
          spotify: {
            playlist: items[0],
          },
        },
      },
    };
  }

  throw 'not_found';
};
