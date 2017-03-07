const TAG = path.basename(__filename, '.js');

const MusixMatch = require(__basedir + '/support/musixmatch');

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);
		let { parameters:p, fulfillment, resolvedQuery } = e;
		
		if (p.track) {
			MusixMatch.searchTrack({
				q_track: p.track,
				q_artist: p.artist
			}, (err, body) => {
				if (err) return reject(err);
				if (body == null || body.length === 0) {
					return reject({
						text: `Non sono riuscito a trovare qualcosa per ${p.track}`
					});
				}

				MusixMatch.trackLyrics({
					track_id: body[0].track_id
				}, (err, body) => {
					if (err) return reject(err);

					resolve({
						lyrics: body
					});
				});
			});
		} else {
			reject();
		}
	});
};