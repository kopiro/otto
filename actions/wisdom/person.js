const TAG = path.basename(__filename, '.js');

const rejections = [
'Non so chi sia.. scusami',
'Chi scusa?'
];

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);

		let p = e.parameters;
		
		switch (p.request_type) {
			case 'whatis':
			case 'whois':

			new Memory.Contact()
			.query((qb) => {
				qb.select(Memory.__knex.raw(`*, MATCH (first_name, last_name, alias, tags) AGAINST ("${p.q}" IN NATURAL LANGUAGE MODE) AS score`));
				qb.having('score', '>', '0');
				qb.orderBy(Memory.__knex.raw('RAND()'));
			})
			.fetch({ require: true })
			.then((contact) => {

				new Memory.ContactMemory()
				.where({ id_contact: contact.id })
				.fetchAll()
				.then((memories) => {
					if (memories.length > 0) {
						resolve({
							text: memories.at( _.random(0, memories.length-1) ).get('text')
						});
					} else {
						resolve({
							text: contact.getName()
						});
					}
				});
			})
			.catch(() => {
				reject({
					text: rejections.getRandom()
				});
			});

			break;

			default:
			reject();
			break;
		}

	});
};