require('../boot');
const Spotify = requireLibrary('spotify');
(async () => {
	const data = await Spotify.searchTracks('azzurro');
	console.log(data);
})();
