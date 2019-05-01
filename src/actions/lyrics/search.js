exports.id = 'lyrics.search';

const MusixMatch = require('../../lib/musixmatch');
const { promisify } = require('util');

module.exports = async function main({ queryResult }, session) {
  const { parameters: p } = queryResult;

  const bodyTracks = await promisify(MusixMatch.searchTrack)({
    q_track: p.track,
    q_artist: p.artist,
  });
  if (bodyTracks == null || bodyTracks.length === 0) {
    throw 'not_found';
  }

  const bodyLyrics = await promisify(MusixMatch.trackLyrics)({
    track_id: bodyTracks[0].track_id,
  });
  let text = bodyLyrics.lyrics_body.split('\n');
  text = text.join('. ');
  text = text.replace(/\*\*\*.*/, ''); // remove copyright

  return {
    payload: {
      lyrics: {
        language: bodyLyrics.lyrics_language,
        text,
      },
    },
  };
};
