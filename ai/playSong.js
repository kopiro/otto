const _config = config.ai.spotify;

var SpotifyWebApi = require('spotify-web-api-node');
var spotifyApi = new SpotifyWebApi(_config.options);

module.exports = function playSong(e) {
	return new Promise(function(resolve, reject) {
		var query = e.parameters['music-artist'];
		console.info('AI.playSong', 'search', query);

		spotifyApi.searchTracks(query)
		.then(function(data) {

			try {
				console.info('AI.playSong', 'result', data.body.tracks.items[0].uri);
				resolve({
					spotify: data.body.tracks.items[0]
				});
			} catch (err) {
				reject({ 
					text: 'Non riesco a riprodurre ' + query 
				});
			}

		}, function(err) {
			reject({ 
				text: 'Non riesco a riprodurre ' + query 
			});
		});
	});
};