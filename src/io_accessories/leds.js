exports.id = 'leds';

const RaspiLeds = apprequire('raspi/leds');

const colorForHotword = [ 0, 0, 255 ];
const colorForRecognizing = [ 255, 0, 0 ];

exports.attach = function(io) {
	io.emitter.on('input', () => {
		RaspiLeds.animateRandom();
	});

	io.emitter.on('output', (e) => {
		if (e.fulfillment.data.feedback == false) {
			RaspiLeds.off();
		}
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