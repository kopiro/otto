exports.id = 'wisdom.person';

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		
		switch (p.request_type) {
			case 'whatis':
			case 'whois':

			new ORM.Contact()
			.query((qb) => {
				qb.select(ORM.__knex.raw(`*, MATCH (first_name, last_name, alias, tags) AGAINST ("${p.q}" IN NATURAL LANGUAGE MODE) AS score`));
				qb.having('score', '>', '0');
				qb.orderBy(ORM.__knex.raw('RAND()'));
			})
			.fetch({ require: true })
			.then((contact) => {

				new ORM.ContactMemory()
				.where({ id_contact: contact.id })
				.fetchAll()
				.then((memories) => {
					if (memories.length > 0) {
						resolve({
							speech: memories.at( _.random(0, memories.length-1) ).text
						});
					} else {
						resolve({
							speech: contact.name
						});
					}
				});
			})
			.catch(() => {
				reject();
			});

			break;

			default:
			reject();
			break;
		}

	});
};