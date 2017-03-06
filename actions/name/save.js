const TAG = path.basename(__filename, '.js');

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);
		let { parameters:p, fulfillment, resolvedQuery } = e;

		switch (p.subject) {

			case 'user':
			Memory.Contact.where({ 
				alias: p.name
			})
			.fetch({ 
				require: true 
			})
			.then((contact) => {
				resolve(contact.get('alias_hello'));
			})
			.catch((err) => {
				new Memory.Contact({
					alias: p.name
				})
				.save()
				.then((new_contact) => {
					resolve(`Ciao ${p.name}, piacere di conoscerti!`);
				})
				.catch((err) => {
					reject(err);
				});
			});
			break;

			case 'agent':
			if (AI_NAME_REGEX.test(p.name)) {
				resolve('Si, sono io');
			} else {
				resolve(`No, io mi chiamo Otto!`);
			}
			break;

			default:
			reject();
		}
	});
};