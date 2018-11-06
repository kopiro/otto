exports.id = 'chromecast';

const ChromeCast = apprequire('chromecast');

const Spotify = apprequire('spotify');

const YoutubeCastClient = require('youtube-castv2-client').Youtube;
const SpotifyCastClient = require('spotify-castv2-client').Spotify;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
const _ = require('underscore');

exports.clients = {};

exports.canHandleOutput = function(e, session) {
	if (e.payload.video && (e.payload.video.youtube || e.payload.video.uri))
		return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
	if (e.payload.image && e.payload.image.uri)
		return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
	if (e.payload.music && (e.payload.music.spotify || e.payload.music.uri))
		return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
};

/**
 * Output an object to a Chromecast receiver
 * @param {Object} e
 * @param {Object} session
 */
exports.output = async function(e, session) {
	const cid = session.server_settings.data.chromecast;

	// First connect if never connected to that Chromecast receiver
	if (exports.clients[cid] == null) {
		exports.clients[cid] = await ChromeCast.connect(cid);
	}

	const client = exports.clients[cid];

	// Video Type
	if (e.payload.video) {
		if (e.payload.video.youtube) {
			client.launch(YoutubeCastClient, (err, player) => {
				player.load(e.payload.video.youtube.id);
			});
		} else if (e.payload.video.uri) {
			client.launch(DefaultMediaReceiver, (err, player) => {
				player.load(
					{
						contentId: e.payload.video.uri,
						contentType: 'video/mp4',
						streamType: 'BUFFERED'
					},
					{
						autoplay: true
					},
					() => {}
				);
			});
		} else {
			throw new Error('Unsupported video type');
		}

		return;
	}

	// Music Type
	if (e.payload.music) {
		if (e.payload.music.spotify) {
			client.launch(SpotifyCastClient, async (err, player) => {
				const credentials = await Spotify.getCredentialsForChromecast();

				await player.authenticate({
					access_token: credentials.access_token,
					access_token_expiration: credentials.expiration,
					device_name: client.name
				});

				if (e.payload.music.spotify.track) {
					player.play({
						uris: [e.payload.music.spotify.track.uri]
					});
				} else if (e.payload.music.spotify.artist) {
					player.play({
						context_uri: e.payload.music.spotify.artist.uri
					});
				} else if (e.payload.music.spotify.album) {
					player.play({
						context_uri: e.payload.music.spotify.album.uri
					});
				} else if (e.payload.music.spotify.playlist) {
					player.play({
						context_uri: e.payload.music.spotify.playlist.artist.uri
					});
				}
			});
		} else if (e.payload.music.uri) {
			client.launch(DefaultMediaReceiver, (err, player) => {
				player.load(
					{
						contentId: e.payload.music.uri,
						contentType: 'audio/mp3',
						streamType: 'BUFFERED'
					},
					{
						autoplay: true
					},
					() => {}
				);
			});
		} else {
			throw new Error('Unsupported music type');
		}

		return;
	}

	// Image type
	if (e.payload.image) {
		if (e.payload.image.uri) {
			client.launch(DefaultMediaReceiver, (err, player) => {
				player.load(
					{
						contentId: e.payload.image.uri,
						contentType: 'image/jpg',
						streamType: 'BUFFERED'
					},
					{
						autoplay: true
					},
					() => {}
				);
			});
		} else {
			throw new Error('Unsupported image type');
		}

		return;
	}
};

exports.attach = function(io) {};
