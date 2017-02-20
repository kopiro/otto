const _config = config.ai.spotify;

var SpotifyWebApi = require('spotify-web-api-node');
var spotifyApi = new SpotifyWebApi(_config.options);

module.exports = function(e) {
	return new Promise(function(resolve, reject) {
		let {parameters} = e;

		let query, query_human;
		let random_output;

		if (parameters.music_artist) {
			random_output = true;
			query_human = parameters.music_artist;
			query = 'artist:' + encodeURIComponent(parameters.music_artist);
		} else if (parameters['music-artist']) {
			random_output = true;
			query_human = parameters['music-artist'];
			query = 'artist:' + encodeURIComponent(parameters['music-artist']);
		} else if (parameters.music_song) {
			random_output = false;
			query_human = parameters.music_song;
			query = 'track:' + encodeURIComponent(parameters.music_song);
		} else if (parameters.music_genre) {
			random_output = true;
			query_human = parameters.music_genre;
			query = 'genre:' + encodeURIComponent(parameters.music_genre);
		}

		console.debug('AI.mediaPlay', 'search', query);

		spotifyApi.searchTracks(query)
		.then(function(data) {

			try {

				let {items} = data.body.tracks;
				if (items.length === 0) throw 'Zero length results';

				let song = items[ random_output ? _.random(0, items.length) : 0 ];
				song = _.pick(song, 'uri', 'href');
				console.debug('AI.mediaPlay', 'result', JSON.stringify(song, null, 2));

				resolve({
					spotify: song
				});

			} catch (err) {
				reject({
					err: err, 
					text: 'Non riesco a riprodurre ' + query_human 
				});
			}

		}, (err) => {
			reject({ 
				err: err,
				text: 'Non riesco a riprodurre quello che mi chiedi'
			});
		});
	});
};