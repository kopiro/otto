const TAG = 'MusixMatch';

const _ = require('underscore');
const request = require('fs');

const _config = config.ai.musixmatch;

const endpoint = "https://musixmatchcom-musixmatch.p.mashape.com/wsr/1.1/";

function req(opt, callback) {
	console.debug(TAG, 'input', opt);

	request(_.extend({
		json: true,
		headers: {
			'X-Mashape-Key': _config.apiKey
		},
	}, opt), (err, response, body) => {
		if (err) {
			console.error(TAG, err);
			return callback(err);
		}

		console.debug(TAG, 'result', body);
		callback(null, body);
	});
}

exports.searchTrack = function(opt, callback) {
	let call = "track.search";
	opt = _.defaults(opt, {
		f_has_lyrics: 1,
		page: 1,
		page_size: 5,
		q: "",
		q_artist: "",
		q_lyrics: "",
		q_track: "",
		q_track_artist: "",
		s_track_rating: "desc"
	});

	req({
		url: endpoint + call,		
		qs: opt
	}, function(error, body) {
		if (callback) {
			callback(error, body);
		}
	});
};

exports.trackLyrics = function(opt, callback) {
	let call = "track.lyrics.get";
	opt = _.defaults(opt, {
		track_id: ''
	});

	req({
		url: endpoint + call,
		qs: opt
	}, function(error, body) {
		if (callback) callback(error, body);
	});
};

exports.music = function(opt, callback) {
	let call = "track.get";
	opt = _.defaults(opt, {
		track_id: 0,
	});

	req({
		url: endpoint + call,
		qs: opt
	}, function(error, body) {
		if (callback) callback(error, body);
	});
};


exports.artist = function(opt, callback) {
	let call = "artist.get";
	opt = _.defaults(opt, {
		artist_id: 0,
	});

	req({
		url: endpoint + call,
		qs: opt
	}, function(error, body) {
		if (callback) callback(error, body);
	});
};