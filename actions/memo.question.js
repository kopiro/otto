const TAG = path.basename(__filename);

module.exports = function(e, io) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);
		let { parameters:p, fulfillment, resolvedQuery } = e;

		DB.query(`
		SELECT *, MATCH (title, tags) AGAINST ("${resolvedQuery}" IN NATURAL LANGUAGE MODE) AS score 
		FROM memories
		ORDER BY score DESC
		`, (err, data) => {
			if (err) {
				console.error(TAG, err);
				reject(err);
			}

			if (data.length === 0) {
				return reject('Non ho ricordi di questa cosa');
			}

			data = _.filter(data, (row) => { return row.score >= 0.7; });

			let memory = new Memory.Memory(data[_.random(0, data.length-1)]);

			let text = (fulfillment.speech || "") + " ";
			if (memory.get('text')) text += memory.get('text') + " ";
			if (io.capabilities.userCanViewUrls && memory.get('url')) {
				text += memory.get('url') +  " ";
			}
			resolve(text);

		});
	});
};