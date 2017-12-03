exports.id = 'lyrics.search';

const MusixMatch = apprequire('musixmatch');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		
		MusixMatch.searchTrack({
			q_track: p.track,
			q_artist: p.artist
		}, (err, body) => {
			if (err) return reject(err);
			if (body == null || body.length === 0) {
				return reject(fulfillment.payload.error);
			}

			MusixMatch.trackLyrics({
				track_id: body[0].track_id
			}, (err, body) => {
				console.log(body);
				if (err) {
					return reject(fulfillment.payload.error);
				}


				let text = body.lyrics_body.split("\n");
				text = text.join(". ");
				text = text.replace(/\*\*\*.*/, ''); // remove copyright

				resolve({
					data: {
						lyrics: {
							language: body.lyrics_language,
							text: text
						}
					}
				});
			});
		});
	});
};