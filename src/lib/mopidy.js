const TAG = 'Mopidy';

const mopidy = require('mopidy');
const client = new mopidy({
	webSocketUrl: 'ws://localhost:6680/mopidy/ws/',
	autoConnect: false
});

client.ensureConnected = function() {
	return new Promise(async(resolve) => {
		if (client._connected) return resolve();
		client.on('state:online', () => {
			console.debug(TAG, 'connected');
			client._connected = true;
			resolve();
		});
		client.connect();
	});
};

client.playTrackByUriNow = async function(uri) {
	await client.tracklist.clear();
	const tracks = await client.library.lookup(uri);
	const ttl_tracks = await client.tracklist.add([tracks[0]]);
	return client.playback.play(ttl_tracks[0]);
};

module.exports = client;