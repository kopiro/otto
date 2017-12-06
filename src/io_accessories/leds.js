exports.id = 'leds';

const RaspiLeds = apprequire('raspi/leds');

const colorForActive = [ 0, 0, 255 ];

exports.attach = function(io) {
	io.emitter.on('input', () => {
		RaspiLeds.animateRandom();
	});

	io.emitter.on('output', () => {
		RaspiLeds.off();
	});

	io.emitter.on('wake', () => {
		RaspiLeds.setColor(colorForActive);
	});

	io.emitter.on('stop', () => {
		RaspiLeds.off();
	});
};