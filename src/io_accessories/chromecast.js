exports.id = 'chromecast';

const ChromeCast = apprequire('chromecast');

const YoutubeCastClient  = require('youtube-castv2-client').Youtube;
const DefaultMediaReceiver  = require('castv2-client').DefaultMediaReceiver;

exports.canHandleOutput = function(e, session) {
	if (e.data.video) return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
	if (e.data.image) return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
};

exports.output = async function(e, session) {
	const client = await ChromeCast.connect(session.settings.data.chromecast);

	if (e.data.video) {
		if (e.data.video.youtube) {
			client.launch(YoutubeCastClient, (err, player) => {
				player.load(e.data.video.youtube.id);
			});
		}
	}

	if (e.data.image) {
		client.launch(DefaultMediaReceiver, function(err, player) {
			var media = {
				contentId: e.data.image.uri,
				contentType: 'image/jpg',
				streamType: 'BUFFERED'     
			};
			player.load(media, { autoplay: true }, () => {});
		});
	}
};

exports.attach = function(io) {};