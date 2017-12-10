require('../boot');
const Spotify = apprequire('spotify');
(async () => {
	await Spotify.ensureConnected();
	const data = await Spotify.searchTracks('azzurro');
	console.log(data);
})();