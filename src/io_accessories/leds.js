exports.id = 'leds';

const RaspiLeds = apprequire('raspi/leds');

const colorForHotword = [ 0, 0, 255 ];
const colorForRecognizing = [ 255, 0, 0 ];
const colorForOutput = [ 0, 255, 0 ];

exports.attach = function(io) {
	RaspiLeds.off();

	io.emitter.on('input', () => {
		RaspiLeds.animateRandom();
	});

	io.emitter.on('output', () => {
		RaspiLeds.setColor(colorForOutput);
	});

	io.emitter.on('thinking', () => {
		RaspiLeds.animateRandom();
	});

	io.emitter.on('recognizing', () => {
		RaspiLeds.setColor(colorForRecognizing);
	});

	io.emitter.on('notrecognizing', () => {
		RaspiLeds.off();
	});

	io.emitter.on('wake', () => {
		RaspiLeds.setColor(colorForHotword);
	});

	io.emitter.on('stop', () => {
		RaspiLeds.off();
	});
};