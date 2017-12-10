exports.id = 'leds';

const RaspiLeds = apprequire('raspi/leds');

const colorForHotword = [ 0, 0, 255 ];
const colorForRecognizing = [ 255, 0, 0 ];
const colorForOutput = [ 0, 255, 0 ];

exports.attach = function(io) {
	RaspiLeds.off();

	io.emitter.on('input', () => {
		console.log('EVENT', 'input');
		RaspiLeds.animateRandom();
	});

	io.emitter.on('output', () => {
		console.log('EVENT', 'output');
		RaspiLeds.setColor(colorForOutput);
	});

	io.emitter.on('thinking', () => {
		console.log('EVENT', 'thinking');
		RaspiLeds.animateRandom();
	});

	io.emitter.on('recognizing', () => {
		console.log('EVENT', 'recognizing');
		RaspiLeds.setColor(colorForRecognizing);
	});

	io.emitter.on('notrecognizing', () => {
		console.log('EVENT', 'notrecognizing');
		RaspiLeds.off();
	});

	io.emitter.on('wake', () => {
		console.log('EVENT', 'wake');
		RaspiLeds.setColor(colorForHotword);
	});

	io.emitter.on('stop', () => {
		console.log('EVENT', 'stop');
		RaspiLeds.off();
	});
};