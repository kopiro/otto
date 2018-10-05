exports.id = 'mopidy';

const Mopidy = apprequire('mopidy');

exports.canHandleOutput = function (e) {
	if (e.data.music && (e.data.music.spotify || e.data.music.uri || e.data.music.action)) return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
};

exports.output = async function (e, session) {
	if (e.data.music) {
		await Mopidy.connect();

		if (e.data.music.action) {
			await Mopidy.playback[e.data.music.action]();
		} else if (e.data.music.spotify.track) {
			await Mopidy.playTrackByUriNow(e.data.music.spotify.track.uri);
		} else if (e.data.music.uri) {
			await Mopidy.playTrackByUriNow(e.data.music.uri);
		} else {
			throw new Error('Unsupported music type');
		}
	}
};

exports.attach = function (io) {};