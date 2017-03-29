exports.id = 'lyrics.search';

const MusixMatch = require(__basedir + '/support/musixmatch');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		
		if (p.track) {
			MusixMatch.searchTrack({
				q_track: p.track,
				q_artist: p.artist
			}, (err, body) => {
				if (err) return reject(err);
				if (body == null || body.length === 0) return reject();

				MusixMatch.trackLyrics({
					track_id: body[0].track_id
				}, (err, body) => {
					if (err) return reject();

					resolve({
						data: {
							lyrics: body
						}
					});
				});
			});
		} else {
			reject();
		}
	});
};