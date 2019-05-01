exports.id = 'lyrics.track';

const MusixMatch = require('../../lib/musixmatch');
const { promisify } = require('util');

module.exports = async function main({ queryResult }, session) {
  const { parameters: p } = queryResult;

  const bodyTrack = await promisify(MusixMatch.searchTrack)({
    q_lyrics: p.q,
  });
  if (bodyTrack == null || bodyTrack.length === 0) {
    throw 'not_found';
  }

  let speech = [];
  bodyTrack.forEach((f) => {
    speech.push(`${f.track_name} di ${f.artist_name}.`);
  });
  speech = speech.join('\n');

  return speech;
};
