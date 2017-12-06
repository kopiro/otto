exports.id = 'lyrics.track';

const MusixMatch = apprequire('musixmatch');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		
		MusixMatch.searchTrack({
			q_lyrics: p.q
		}, (err, body) => {
			if (err) return reject(err);
			if (body == null || body.length === 0) {
				return reject(fulfillment.payload.error);
			}

			let speech = [];
			body.forEach((f, i) => {
				speech.push(f.artist_name + ' - ' + f.track_name);
			});
			speech = speech.join("\n");

			return resolve({
				speech: speech
			});
		});
	});
};