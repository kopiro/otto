exports.id = 'spotify_connect';

const spotify = requireLibrary('spotify');

exports.canHandleOutput = function(e, session) {
	if (session.settings.spotify == null) {
		return IOManager.CAN_HANDLE_OUTPUT.NO;
	}

	if (e.payload.music != null && e.payload.music.spotify) {
		return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
	}

	if (e.payload.media) {
		return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
	}
};

exports.output = async function(e, session) {
	const api = await spotify.initWithSession(session);

	if (e.payload.music != null && e.payload.music.spotify != null) {
		if (e.payload.music.spotify.track != null) {
			await api.play({
				uris: [e.payload.music.spotify.track.uri]
			});
		} else if (e.payload.music.spotify.artist != null) {
			await api.play({
				context_uri: e.payload.music.spotify.artist.uri
			});
		} else if (e.payload.music.spotify.album != null) {
			await api.play({
				context_uri: e.payload.music.spotify.album.uri
			});
		}
	}

	if (e.payload.media != null && e.payload.media.action != null) {
		switch (e.payload.media.action) {
			case 'pause':
				await api.pause();
				break;
			case 'play':
				await api.play();
				break;
			case 'next':
				await api.skipToNext();
				break;
			case 'previous':
				await api.skipToPrevious();
				break;
		}
	}
};

exports.attach = function(io) {};
