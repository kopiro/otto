const _config = config.ai.musixmatch;
const TAG = path.basename(__filename, '.js');

const endpoint = "https://musixmatchchcom-musixmatch.p.mashape.com/wsr/1.1/";

exports.api = function(opt, callback) {
	
};


exports.searchMusic = function(opt, callback) {
	let call = "track.search";
	opt = _.deafults({
		f_has_lyrics: 1,
		page: 1,
		page_size: 5,
		q: "",
		q_artist: "",
		q_lyrics: "",
		q_track: "",
		q_track_artist: "",
		s_track_rating: "desc"
	}, opt);

	request({
		url: endpoint + call,
		json: true,
		headers: {
			'X-Mashape-Key': _config.apiKey
		},
		qs: opt
	}, function(error, response, body) {
		console.debug(TAG, 'result', body);
		if (callback) callback(error, body);
	});
};

exports.music = function(opt, callback) {
	let call = "track.get";
	opt = _.deafults({
		track_id: 0,
	}, opt);

	request({
		url: endpoint + call,
		json: true,
		headers: {
			'X-Mashape-Key': _config.apiKey
		},
		qs: opt
	}, function(error, response, body) {
		console.debug(TAG, 'result', body);
		if (callback) callback(error, body);
	});
};


exports.artist = function(opt, callback) {
	let call = "artist.get";
	opt = _.deafults({
		artist_id: 0,
	}, opt);

	request({
		url: endpoint + call,
		json: true,
		headers: {
			'X-Mashape-Key': _config.apiKey
		},
		qs: opt
	}, function(error, response, body) {
		console.debug(TAG, 'result', body);
		if (callback) callback(error, body);
	});
};