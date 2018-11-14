require('../boot');
const Spotify = apprequire('spotify');
(async () => {
	const data = await Spotify.searchTracks('azzurro');
	console.log(data);
})();
