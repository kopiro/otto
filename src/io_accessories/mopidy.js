exports.id = 'mopidy';

const Mopidy = apprequire('mopidy');

exports.canHandleOutput = function(e) {
	if (
		e.payload.music &&
		(e.payload.music.spotify || e.payload.music.uri || e.payload.music.action)
	)
		return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
};

exports.output = async function(e, session) {
	if (e.payload.music) {
		await Mopidy.connect();

		if (e.payload.music.action) {
			await Mopidy.playback[e.payload.music.action]();
		} else if (e.payload.music.spotify.track) {
			await Mopidy.playTrackByUriNow(e.payload.music.spotify.track.uri);
		} else if (e.payload.music.uri) {
			await Mopidy.playTrackByUriNow(e.payload.music.uri);
		} else {
			throw new Error('Unsupported music type');
		}
	}
};

exports.attach = function(io) {};
