const TAG = path.basename(__filename, '.js');

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);

		let p = e.parameters;
		
		switch (p.request_type) {
			case 'whatis':
			case 'whois':

			DB.query(`
			SELECT *, MATCH (first_name, last_name, alias, tags) AGAINST ("${p.q}" IN NATURAL LANGUAGE MODE) AS score 
			FROM contacts
			ORDER BY score DESC
			`, (err, data) => {
				if (err) {
					console.error(TAG, err);
					return reject();
				}

				data = _.filter(data, (row) => { return row.score >= 0.7; });
				if (data.length === 0) {
					return reject({
						text: 'Non so chi sia :('
					});
				}

				let contact = new Memory.Contact( data.getRandom() );

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

				
			});

			break;

			default:
			reject();
			break;
		}

	});
};