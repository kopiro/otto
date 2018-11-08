exports.id = 'music.play';

const Spotify = requireLibrary('spotify');

module.exports = async function({ queryResult }) {
	let { parameters: p } = queryResult;

	await Spotify.init();

	if (p.track) {
		const data = await Spotify.searchTracks(`${p.track} ${p.artist}`);
		const items = data.body.tracks.items;
		if (items.length === 0) throw 'not_found';

		return {
			payload: {
				music: {
					spotify: {
						track: items[0]
					}
				}
			}
		};
	}

	if (p.artist) {
		const data = await Spotify.searchArtists(p.artist);
		let items = data.body.artists.items;
		if (items.length === 0) throw 'not_found';

		return {
			payload: {
				music: {
					spotify: {
						artist: items[0]
					}
				}
			}
		};
	}

	if (p.playlist) {
		const data = await Spotify.searchPlaylists(p.playlist);
		let items = data.body.playlists.items;
		if (items.length === 0) throw 'not_found';

		return {
			payload: {
				music: {
					spotify: {
						playlist: items[0]
					}
				}
			}
		};
	}

	throw 'not_found';
};
