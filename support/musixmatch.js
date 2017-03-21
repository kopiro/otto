const _config = config.ai.musixmatch;
const TAG = 'MusixMatch';

const endpoint = "https://musixmatchcom-musixmatch.p.mashape.com/wsr/1.1/";

exports.api = function(opt, callback) {
	
};


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

	console.log( _config.apiKey );
	request({
		url: endpoint + call,
		json: true,
		headers: {
			'X-Mashape-Key': _config.apiKey
		},
		qs: opt
	}, function(error, response, body) {
		console.debug(TAG, call, 'result', body);
		if (callback) {
			callback(error, (body || '').replace(/\*\*\*\*\*\*\*.*/mg, ''));
		}
	});
};

exports.trackLyrics = function(opt, callback) {
	let call = "track.lyrics.get";
	opt = _.defaults(opt, {
		track_id: ''
	});

	console.log(opt);

	request({
		url: endpoint + call,
		json: true,
		headers: {
			'X-Mashape-Key': _config.apiKey
		},
		qs: opt
	}, function(error, response, body) {
		console.debug(TAG, call, 'result', body);
		if (callback) callback(error, body);
	});
};

exports.music = function(opt, callback) {
	let call = "track.get";
	opt = _.defaults(opt, {
		track_id: 0,
	});

	request({
		url: endpoint + call,
		json: true,
		headers: {
			'X-Mashape-Key': _config.apiKey
		},
		qs: opt
	}, function(error, response, body) {
		console.debug(TAG, call, 'result', body);
		if (callback) callback(error, body);
	});
};


exports.artist = function(opt, callback) {
	let call = "artist.get";
	opt = _.defaults(opt, {
		artist_id: 0,
	});

	request({
		url: endpoint + call,
		json: true,
		headers: {
			'X-Mashape-Key': _config.apiKey
		},
		qs: opt
	}, function(error, response, body) {
		console.debug(TAG, call, 'result', body);
		if (callback) callback(error, body);
	});
};