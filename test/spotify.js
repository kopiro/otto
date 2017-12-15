require('../boot');
const Spotify = apprequire('spotify');
(async () => {
	await Spotify.connect();
	const data = await Spotify.searchTracks('azzurro');
	console.log(data);
})();