const _config = config.ai.spotify;

var SpotifyWebApi = require('spotify-web-api-node');
var spotifyApi = new SpotifyWebApi(_config.options);
var spotifyAppleScript = require('spotify-node-applescript');

module.exports = function playSong(request) {
	return new Promise(function(resolve, reject) {
		var query = request.entities.playableitem[0].value;
		console.info('AI.playSong', 'search', query);

		spotifyApi.searchTracks(query)
		.then(function(data) {

			try {

				var url = data.body.tracks.items[0].uri;
				console.info('AI.playSong', 'result url', url);

				spotifyAppleScript.playTrack(url);
				resolve();

			} catch (err) {
				reject({ text: 'Non riesco a riprodurre ' + query });
			}

		}, function(err) {
			reject({ text: 'Non riesco a riprodurre ' + query });
		});
	});
};