exports.id = 'memo.question';

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		new Memory.Memory()
		.query((qb) => {
			qb.select(Memory.__knex.raw(`*, MATCH (tags) AGAINST ("${p.q}" IN NATURAL LANGUAGE MODE) AS score`));
			qb.having('score', '>', '0');
			qb.orderBy(Memory.__knex.raw('RAND()'));
		})
		.fetch({ require: true })
		.then((memory) => {
			resolve({
				data: {
					url: memory.get('url')
				},
				speech: memory.get('text')
			});
		})
		.catch((err) => {
			reject();
		});
	});
};