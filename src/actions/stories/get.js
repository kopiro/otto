exports.id = 'stories.get';

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		new ORM.Story()
		.query((qb) => {
			qb.select(ORM.__knex.raw(`*, MATCH (tags) AGAINST ("${p.q}" IN NATURAL LANGUAGE MODE) AS score`));
			qb.having('score', '>', '0');
			qb.orderBy(ORM.__knex.raw('RAND()'));
		})
		.fetch({ require: true })
		.then((story) => {
			resolve({
				speech: story.text,
				data: {
					url: story.url
				}
			});
		})
		.catch(reject);
	});
};