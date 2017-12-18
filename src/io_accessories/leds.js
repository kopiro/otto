const TAG = 'Leds';

exports.id = 'leds';

const RaspiLeds = apprequire('raspi/leds');

const colorForHotword = [ 0, 0, 255 ];
const colorForRecognizing = [ 255, 0, 0 ];
const colorForOutput = [ 0, 255, 0 ];

exports.canHandleOutput = function(e) { return false; };

exports.attach = function(io) {
	RaspiLeds.off();

	io.emitter.on('input', () => {
		console.debug(TAG, 'input');
		RaspiLeds.animateRandom();
	});

	io.emitter.on('output', () => {
		console.debug(TAG, 'output');
		RaspiLeds.setColor(colorForOutput);
	});

	io.emitter.on('thinking', () => {
		console.debug(TAG, 'thinking');
		RaspiLeds.animateRandom();
	});

	io.emitter.on('recognizing', () => {
		console.debug(TAG, 'recognizing');
		RaspiLeds.setColor(colorForRecognizing);
	});

	io.emitter.on('notrecognizing', () => {
		console.debug(TAG, 'notrecognizing');
		RaspiLeds.off();
	});

	io.emitter.on('wake', () => {
		console.debug(TAG, 'wake');
		RaspiLeds.setColor(colorForHotword);
	});

	io.emitter.on('stop', () => {
		console.debug(TAG, 'stop');
		RaspiLeds.off();
	});
};