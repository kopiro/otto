exports.id = 'chromecast';

const ChromeCast = apprequire('chromecast');

const Spotify = apprequire('spotify');

const YoutubeCastClient = require('youtube-castv2-client').Youtube;
const SpotifyCastClient = require('spotify-castv2-client').Spotify;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
const _ = require('underscore');

exports.clients = {};

exports.canHandleOutput = function (e, session) {
	if (e.data.video && (e.data.video.youtube || e.data.video.uri)) return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
	if (e.data.image && (e.data.image.uri)) return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
	if (e.data.music && (e.data.music.spotify || e.data.music.uri)) return IOManager.CAN_HANDLE_OUTPUT.YES_AND_BREAK;
};

/**
 * Output an object to a Chromecast receiver
 * @param {Object} e 
 * @param {Object} session 
 */
exports.output = async function (e, session) {
	const cid = session.server_settings.data.chromecast;

	// First connect if never connected to that Chromecast receiver
	if (exports.clients[cid] == null) {
		exports.clients[cid] = await ChromeCast.connect(cid);
	}

	const client = exports.clients[cid];

	// Video Type
	if (e.data.video) {
		if (e.data.video.youtube) {
			client.launch(YoutubeCastClient, (err, player) => {
				player.load(e.data.video.youtube.id);
			});
		} else if (e.data.video.uri) {
			client.launch(DefaultMediaReceiver, (err, player) => {
				player.load({
					contentId: e.data.video.uri,
					contentType: 'video/mp4',
					streamType: 'BUFFERED'
				}, {
					autoplay: true
				}, () => {});
			});
		} else {
			throw new Error('Unsupported video type');
		}

		return;
	}

	// Music Type
	if (e.data.music) {
		if (e.data.music.spotify) {
			client.launch(SpotifyCastClient, async (err, player) => {
				const credentials = await Spotify.getCredentialsForChromecast();

				await player.authenticate({
					access_token: credentials.access_token,
					access_token_expiration: credentials.expiration,
					device_name: client.name
				});

				if (e.data.music.spotify.track) {
					player.play({
						uris: [e.data.music.spotify.track.uri]
					});
				} else if (e.data.music.spotify.artist) {
					player.play({
						context_uri: e.data.music.spotify.artist.uri
					});
				} else if (e.data.music.spotify.album) {
					player.play({
						context_uri: e.data.music.spotify.album.uri
					});
				} else if (e.data.music.spotify.playlist) {
					player.play({
						context_uri: e.data.music.spotify.playlist.artist.uri
					});
				}
			});
		} else if (e.data.music.uri) {
			client.launch(DefaultMediaReceiver, (err, player) => {
				player.load({
					contentId: e.data.music.uri,
					contentType: 'audio/mp3',
					streamType: 'BUFFERED'
				}, {
					autoplay: true
				}, () => {});
			});
		} else {
			throw new Error('Unsupported music type');
		}

		return;
	}

	// Image type
	if (e.data.image) {
		if (e.data.image.uri) {
			client.launch(DefaultMediaReceiver, (err, player) => {
				player.load({
					contentId: e.data.image.uri,
					contentType: 'image/jpg',
					streamType: 'BUFFERED'
				}, {
					autoplay: true
				}, () => {});
			});
		} else {
			throw new Error('Unsupported image type');
		}

		return;
	}
};

exports.attach = function (io) {};