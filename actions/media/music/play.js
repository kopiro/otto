exports.id = 'media.music.play';

const _config = config.ai.spotify;

var SpotifyWebApi = require('spotify-web-api-node');
var spotifyApi = new SpotifyWebApi(_config.options);

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
	
		if (p.artist) {
			spotifyApi.searchArtists(p.artist)
			.then(function(data) {
				console.debug(exports.id, 'searchArtists', data.body);

				let items = data.body.artists.items;
				if (items.length === 0) {
					return reject();
				}

				resolve({
					data: {
						media: {
							artist: items[0]
						}
					}
				});

			}, reject);

		} else if (p.track) {
			spotifyApi.searchTracks(p.track)
			.then(function(data) {
				console.debug(exports.id, 'searchTracks', data.body);

				let items = data.body.tracks.items;
				if (items.length === 0) {
					return reject();
				}

				resolve({
					data: {
						media: {
							track: items[0]
						}
					}
				});
			}, reject);
		
		} else if (p.playlist) {
			spotifyApi.searchPlaylists(p.playlist)
			.then(function(data) {
				console.debug(exports.id, 'searchPlaylists', data.body);

				let items = data.body.playlists.items;
				if (items.length === 0) {
					return reject();
				}

				resolve({
					data: {
						media: {
							playlist: items[0]
						}
					}
				});
			}, reject);
			
		} else {
			reject();
		}
		
	});
};