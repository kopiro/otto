exports.id = 'findmyfriends';

const iCloud = require('apple-icloud');

module.exports = async function ({
	sessionId,
	result
}, session) {
	return new Promise((resolve, reject) => {
		let {
			parameters: p,
			fulfillment
		} = result;

		if (session.settings.icloud == null) {
			return reject({
				speech: fulfillment.payload.errors.not_configured
			});
		}

		const icloud = new iCloud(
			session.settings.icloud,
			session.settings.icloud.username,
			session.settings.icloud.password
		);

		icloud.on('ready', async () => {
			const locations = await icloud.Friends.getLocations();

			// Find requested name in locations
			const regex_name = new RegExp(p.name.toLowerCase(), 'i');
			const person = locations
				.filter(e => e.person != null)
				.find(e =>
					e.person.info.invitationAcceptedHandles.find(f => regex_name.test(f))
				);

			if (person == null) {
				return reject({
					speech: fulfillment.payload.errors.person_not_found
				});
			}

			resolve({
				speech: fulfillment.speech.replace(
					'$_address',
					person.adress.country +
					', ' +
					person.adress.locality +
					', ' +
					person.adress.streetAddress
				)
			});
		});
	});
};