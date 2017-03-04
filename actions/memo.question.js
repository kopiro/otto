const TAG = path.basename(__filename);

module.exports = function(e, io) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);
		let { parameters:p, fulfillment, resolvedQuery } = e;

		DB.query(`
		SELECT *, MATCH (tags) AGAINST ("${p.q}" IN NATURAL LANGUAGE MODE) AS score 
		FROM memories
		ORDER BY score DESC
		`, (err, data) => {
			if (err) {
				console.error(TAG, err);
				reject(err);
			}

			data = _.filter(data, (row) => { return row.score >= 0.7; });
			if (data.length === 0) {
				return resolve('Non ho ricordi di questa cosa');
			}
			
			let memory = new Memory.Memory( data.getRandom() );

			let text = (fulfillment.speech || "") + " ";
			if (memory.get('text')) text += memory.get('text') + " ";
			if (io.capabilities.userCanViewUrls && memory.get('url')) {
				text += memory.get('url') +  " ";
			}
			resolve(text);

		});
	});
};