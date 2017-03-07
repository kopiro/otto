const TAG = path.basename(__filename);

const rejections = [
	'Non ho ricordi di questa cosa'
];

module.exports = function(e, io) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);
		let { parameters:p, fulfillment, resolvedQuery } = e;

		new Memory.Memory()
		.query((qb) => {
			qb.select(Memory.__knex.raw(`*, MATCH (tags) AGAINST ("${p.q}" IN NATURAL LANGUAGE MODE) AS score`));
			qb.having('score', '>', '0');
			qb.orderBy(Memory.__knex.raw('RAND()'));
		})
		.fetch({ require: true })
		.then((memory) => {
			let text = [];
			text.push(fulfillment.speech || "");
			if (memory.get('text')) text.push(memory.get('text'));
			if (io.capabilities.userCanViewUrls && memory.get('url')) text.push(memory.get('url'));
			
			resolve({
				text: text.join(' ')
			});
		})
		.catch((err) => {
			reject({
				exception: err,
				text: rejections.getRandom()
			});
		});
	});
};