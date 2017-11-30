const TAG = 'MIIO';

const miio = require('miio');
const _config = config.miio;

miio.retrieveDefaultDevice = function() {
	return miio.device(_config.devices[0]);
};

module.exports = miio;