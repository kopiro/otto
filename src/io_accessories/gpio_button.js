exports.id = 'gpio_button';

const rpio = require('rpio');

exports.canHandleOutput = function() { 
	return false; 
};

exports.attach = function(io) {
	rpio.open(config.gpio_button.pin, rpio.INPUT, rpio.PULL_UP); 
	rpio.poll(config.gpio_button.pin, (pin) => {
		const pressed = !rpio.read(pin);
		if (pressed) {
			io.emitter.emit('wake');
		}
	});
};