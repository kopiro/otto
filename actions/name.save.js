const TAG = path.basename(__filename, '.js');

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);
		let { parameters, fulfillment, resolvedQuery } = e;

		switch (parameters.subject) {

			case 'user':
			Memory.Contact.where({ 
				name: parameters.name
			})
			.fetch({ 
				require: true 
			})
			.then((contact) => {
				resolve(contact.get('alias_hello'));
			})
			.catch((err) => {
				new Memory.Contact({
					name: parameters.name
				})
				.save()
				.then((new_contact) => {
					resolve(`Ciao ${parameters.name}, piacere di conoscerti!`);
				})
				.catch((err) => {
					reject(err);
				});
			});
			break;

			case 'agent':
			if (AI_NAME_REGEX.test(parameters.name)) {
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