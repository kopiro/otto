const TAG = 'MIIO';

const miio = require('miio');
const _config = config.miio;

miio.retrieveDefaultDevice = function() {
	return new Promise((resolve) => {
		const devices = miio.devices({ cacheTime: 300 });
		devices.on('available', reg => {
			if (reg.id === _config.devices[0].id) {
				resolve(miio.device({
					address: reg.address,
					token: _config.devices[0].token
				}));
			}
		});
	});
};

module.exports = miio;