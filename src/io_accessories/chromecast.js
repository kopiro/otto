exports.id = 'chromecast';

const ChromeCast = apprequire('chromecast');

const spotify = apprequire('spotify');

const YoutubeCastClient = require('youtube-castv2-client').Youtube;
const SpotifyCastClient = require('spotify-castv2-client').Spotify;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
const _ = require('underscore');

exports.clients = {};

exports.canHandleOutput = function (e, session) {
	if (e.data.video) return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
	if (e.data.image) return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
	if (e.data.music) return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
};

exports.output = async function (e, session) {
	const cid = session.server_settings.data.chromecast;
	if (exports.clients[cid] == null) {
		exports.clients[cid] = await ChromeCast.connect(cid);
	}

	const client = exports.clients[cid];

	if (e.data.video) {
		if (e.data.video.youtube) {
			client.launch(YoutubeCastClient, (err, player) => {
				player.load(e.data.video.youtube.id);
			});
		}
	}

	if (e.data.music) {
		client.launch(SpotifyCastClient, async (err, player) => {
			const credentials = await spotify.getCredentialsForChromecast();

			await player.authenticate({
				access_token: credentials.access_token,
				access_token_expiration: credentials.expiration,
				device_name: client.name
			});

			if (e.data.music.track) {
				player.play({
					uris: [e.data.music.track.uri]
				});
			} else if (e.data.music.artist) {
				player.play({
					context_uri: e.data.music.artist.uri
				});
			} else if (e.data.music.album) {
				player.play({
					context_uri: e.data.music.album.uri
				});
			} else if (e.data.music.playlist) {
				player.play({
					context_uri: e.data.playlist.artist.uri
				});
			}
		});
	}

	if (e.data.image) {
		client.launch(DefaultMediaReceiver, function (err, player) {
			var media = {
				contentId: e.data.image.uri,
				contentType: 'image/jpg',
				streamType: 'BUFFERED'
			};
			player.load(media, {
				autoplay: true
			}, () => {});
		});
	}
};

exports.attach = function (io) {};