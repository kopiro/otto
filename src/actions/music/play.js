exports.id = 'music.play';

const Spotify = apprequire('spotify');

module.exports = async function({ result }) {
	let { parameters: p, fulfillment } = result;

	await Spotify.ensureConnected();
	
	if (p.track) {
		const data = await Spotify.searchTracks(p.track + (p.artist ? (' ' + p.artist) : ''));
		const items = data.body.tracks.items;
		if (items.length === 0) throw fulfillment.payload.error;
		return {
			data: {
				music: {
					track: {
						name: items[0].name,
						uri: items[0].uri,
						share_url: items[0].external_urls.spotify
					}
				}
			}
		};
	}

	if (p.artist) {
		const data = await Spotify.searchArtists(p.artist);
		let items = data.body.artists.items;
		if (items.length === 0) throw fulfillment.payload.error;
		return {
			data: {
				music: {
					artist: items[0]
				}
			}
		};
	}

	if (p.playlist) {
		const data = await Spotify.searchPlaylists(p.playlist);
		let items = data.body.playlists.items;
		if (items.length === 0) throw fulfillment.payload.error;
		return {
			data: {
				music: {
					playlist: items[0]
				}
			}
		};
	}

	throw fulfillment.payload.error;
};