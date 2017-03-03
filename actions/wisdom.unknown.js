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
					reject(err);
				}

				data = _.filter(data, (row) => { return row.score >= 0.7; });
				if (data.length === 0) {
					return reject('Non so chi sia :(');
				}

				let contact = new Memory.Contact(data[_.random(0, data.length-1)]);

				resolve({
					text: contact.getName()
				});
			});

			break;
		}

	});
};