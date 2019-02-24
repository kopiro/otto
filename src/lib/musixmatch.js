const TAG = 'MusixMatch';

const _ = require('underscore');
const request = require('request');

const _config = config.musixmatch;

const ENDPOINT = 'https://musixmatchcom-musixmatch.p.mashape.com/wsr/1.1/';

function req(opt, callback) {
  console.debug(TAG, 'input', opt.url);

  request(_.extend({
    json: true,
    headers: {
      'X-Mashape-Key': _config.apiKey,
    },
  }, opt), (err, response, body) => {
    if (err) {
      console.error(TAG, err);
      return callback(err);
    }

    callback(null, body);
  });
}

exports.searchTrack = function (opt, callback) {
  const call = 'track.search';
  opt = _.defaults(opt, {
    f_has_lyrics: 1,
    page: 1,
    page_size: 5,
    q: '',
    q_artist: '',
    q_lyrics: '',
    q_track: '',
    q_track_artist: '',
    s_track_rating: 'desc',
  });

  req({
    url: ENDPOINT + call,
    qs: opt,
  }, (error, body) => {
    if (callback) {
      callback(error, body);
    }
  });
};

exports.trackLyrics = function (opt, callback) {
  const call = 'track.lyrics.get';
  opt = _.defaults(opt, {
    track_id: '',
  });

  req({
    url: ENDPOINT + call,
    qs: opt,
  }, (error, body) => {
    if (callback) callback(error, body);
  });
};
