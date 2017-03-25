exports.id = 'media.music.play';

const _config = config.ai.spotify;

var SpotifyWebApi = require('spotify-web-api-node');
var spotifyApi = new SpotifyWebApi(_config.options);

module.exports = function(e) {
	return new Promise(function(resolve, reject) {
		let { parameters: p } = e;
	
		if (p.artist) {
			spotifyApi.searchArtists(p.artist)
			.then(function(data) {
				console.debug(exports.id, 'searchArtists', data.body);

				let items = data.body.artists.items;
				if (items.length === 0) {
					return reject({
						text: `Non trovo nessun risultato per ${p.artist}`
					});
				}

				resolve({
					media: {
						artist: items[0]
					}
				});

			}, reject);

		} else if (p.track) {
			spotifyApi.searchTracks(p.track)
			.then(function(data) {
				console.debug(exports.id, 'searchTracks', data.body);

				let items = data.body.tracks.items;
				if (items.length === 0) {
					return reject({
						text: `Non trovo nessun risultato per ${p.track}`
					});
				}

				resolve({
					media: {
						track: items[0]
					}
				});
			}, reject);
		
		} else if (p.playlist) {
			spotifyApi.searchPlaylists(p.playlist)
			.then(function(data) {
				console.debug(exports.id, 'searchPlaylists', data.body);

				let items = data.body.playlists.items;
				if (items.length === 0) {
					return reject({
						text: `Non trovo nessun risultato per ${p.playlist}`
					});
				}

				resolve({
					media: {
						playlist: items[0]
					}
				});
			}, reject);
		} else {
			reject();
		}
		
	});
};