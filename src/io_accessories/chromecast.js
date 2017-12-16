exports.id = 'chromecast';

const ChromeCast = apprequire('chromecast');

exports.canHandleOutput = function(e, session) {
	if (e.data.video) return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
};

exports.output = async function(e, session) {
	if (e.data.video) {
		if (e.data.video.youtube) {
			const client = await ChromeCast.connect(session.settings.data.chromecast);
			ChromeCast.castYoutubeVideo(client, e.data.video.youtube.id);
		}
	}
};

exports.attach = function(io) {};