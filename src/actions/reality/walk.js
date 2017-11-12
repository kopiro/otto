exports.id = 'reality.walk';

const _config = config.gpio;
const rpio = require('rpio');

module.exports = function({ sessionId, result }, session_model) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		
		rpio.open(_config.walk, rpio.OUTPUT, rpio.LOW);
		rpio.write(_config.walk, rpio.HIGH);
		rpio.sleep(1);
		rpio.write(12, rpio.LOW);

		resolve();
	});
};