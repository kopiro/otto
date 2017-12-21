const TAG = 'Leds';

exports.id = 'leds';

const RaspiLeds = apprequire('raspi/leds');

const colorForRecognizing = [ 0, 255, 0 ];
const colorForOutput = [ 255, 0, 0 ];
const colorForThinking = [ 255, 255, 0 ];

exports.canHandleOutput = function(e) { return false; };

exports.attach = function(io) {
	RaspiLeds.off();

	io.emitter.on('input', () => {
		console.debug(TAG, 'input');
		RaspiLeds.setColor(colorForThinking);
	});

	io.emitter.on('output', () => {
		console.debug(TAG, 'output');
		RaspiLeds.setColor(colorForOutput);
	});

	io.emitter.on('thinking', () => {
		console.debug(TAG, 'thinking');
		RaspiLeds.setColor(colorForThinking);
	});

	io.emitter.on('recognizing', () => {
		console.debug(TAG, 'recognizing');
		RaspiLeds.setColor(colorForRecognizing);
	});

	io.emitter.on('notrecognizing', () => {
		console.debug(TAG, 'notrecognizing');
		RaspiLeds.off();
	});

	io.emitter.on('stopped', () => {
		console.debug(TAG, 'stop');
		RaspiLeds.off();
	});
};