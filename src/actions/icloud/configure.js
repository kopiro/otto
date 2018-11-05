exports.id = 'icloud.configure';

const iCloud = requireLibrary('icloud');

module.exports = async function({ sessionId, result }, session) {
	let { parameters: p, fulfillment } = result;

	const $ = new iCloud(p.username, p.password);

	try {		
		await $.login();
	} catch (err) {
		if (err.twoFactorAuthenticationIsRequired) {
			// TODO
		}
		throw fulfillment.payload.error;
	}

	session.saveSettings({
		icloud: p
	});

	return {
		speech: fulfillment.speech
	};
};