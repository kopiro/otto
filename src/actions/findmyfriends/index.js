exports.id = 'findmyfriends';

const iCloud = requireLibrary('icloud');

module.exports = async function({ sessionId, result }, session) {
	let { parameters: p, fulfillment } = result;
	const settings = session.settings;
	
	if (settings.icloud == null) {
		throw { speech: fulfillment.payload.errors.not_configured };
	}

	const icloud = new iCloud(settings.icloud.username, settings.icloud.password);
	await icloud.login();

	const locations = await icloud.$.Friends.getLocations();
	
	// Find requested name in locations
	const regex_name = new RegExp(p.name.toLowerCase(), 'i');
	const person = locations
		.filter(e => e.person != null)
		.find(e => e.person.info.invitationAcceptedHandles.find(f => regex_name.test(f)));
	
	if (person == null) {
		throw { speech: fulfillment.payload.errors.person_not_found };
	}

	return {
		speech: fulfillment.speech.replace('$_address', person.adress.country + ', ' + person.adress.locality + ', ' + person.adress.streetAddress)
	};
};