const _config = config.ai.spotify;

var SpotifyWebApi = require('spotify-web-api-node');
var spotifyApi = new SpotifyWebApi(_config.options);
var spotifyAppleScript = require('spotify-node-applescript');

module.exports = function(request) {
	return new Promise(function(resolve, reject) {
		var song = request.entities.playableitem[0].value;
		console.info('AI.playSong', 'search', song);

		spotifyApi.searchTracks(song)
		.then(function(data) {

			var url = data.body.tracks.items[0].uri;
			console.info('AI.playSong', 'result url', url);

			spotifyAppleScript.playTrack(url);
			resolve();

		}, function(err) {
			console.error(err);
		});
	});
};