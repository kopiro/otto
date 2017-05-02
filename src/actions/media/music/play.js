exports.id = 'media.music.play';

const _config = config.ai.spotify;

var SpotifyWebApi = require('spotify-web-api-node');
var spotifyApi = new SpotifyWebApi(_config.options);

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
	
		if (p.track) {
			spotifyApi.searchTracks(p.track + (p.artist ? (' ' + p.artist) : ''))
			.then(function(data) {
				let items = data.body.tracks.items;
				if (items.length === 0) {
					return reject();
				}

				resolve({
					data: {
						media: {
							track: item[0]
						}
					}
				});
			}, reject);
		
		} else if (p.artist) {
			spotifyApi.searchArtists(p.artist)
			.then(function(data) {

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

		} else if (p.playlist) {
			spotifyApi.searchPlaylists(p.playlist)
			.then(function(data) {
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