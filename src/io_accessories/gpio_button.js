exports.id = 'gpio_button';

const rpio = require('rpio');

exports.attach = function(io) {
	rpio.open(16, rpio.INPUT, rpio.PULL_UP); 
	rpio.poll(16, (pin) => {
		const pressed = !rpio.read(pin);
		if (pressed) {
			io.wake();
		}
	});
};