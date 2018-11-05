require('../boot');
const iCloud = requireLibrary('icloud');
const prompt = require('prompt');

const x = new iCloud(process.env.ICLOUD_USERNAME, process.env.ICLOUD_PASSWORD);


async function asyncPrompt() {
	return new Promise((resolve, reject) => {
		prompt.get(["code"], (err, input) => {
			if (err) return reject(err);
			resolve(input["code"]);
		});
	});
}

(async function main(securityCode = null) {
	try {
		await x.login(securityCode);
		console.log('ok');

		var locations = await x.$.Friends.getLocations();
		console.log(JSON.stringify(locations, null, 24));

	} catch (err) {
		console.error(err);
		if (err.twoFactorAuthenticationIsRequired) {
			const code = await asyncPrompt();
			main(code);
		}
	}
})();