exports.id = 'mopidy';

const Mopidy = apprequire('mopidy');

exports.canHandleOutput = function (e) {
	if (e.data.music) return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
};

exports.output = async function (e, session) {
	if (e.data.music) {
		await Mopidy.connect();

		if (e.data.music.action) {
			await Mopidy.playback[e.data.music.action]();
		}
		if (e.data.music.track) {
			await Mopidy.playTrackByUriNow(e.data.music.track.uri);
		}
	}
};

exports.attach = function (io) {};