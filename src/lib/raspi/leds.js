const TAG = 'Raspi/Leds';

const BRIGHTNESS_MAX = 30;
const LEDS_COUNT = 3;

let LedManager;

try {
	// Apa102spi(number of leds, clock divider)
	// The clock divider argument is an even divisor of the base 250MHz rate ranging between 0 and 65536.
	const Apa102spi = require('apa102-spi');
	LedManager = new Apa102spi(3, 100);
} catch (err) {
	console.error(TAG, 'Platform not supported');
	const noop = () => {};
	LedManager = {
		setLedColor: noop,
		sendLeds: noop
	};
}

exports.animation = null;

function setup() {
	if (exports.animation) exports.animation.stop();
}

var LedAnimator = function(ticker, freq) {
	var self = this;

	self.run = true;
	self.tick = 0;

	self.stop = () => { self.run = false; };

	const intv = setInterval(() => {
		if (self.run === false) { 
			clearInterval(intv); 
			return; 
		}
		ticker(self.tick++);
	}, freq);
};

exports.animateRandom = function() {
	setup();
	exports.animation = new LedAnimator(() => {
		LedManager.setLedColor(
			Math.floor(Math.random() * LEDS_COUNT), 
			BRIGHTNESS_MAX, 
			Math.floor(Math.random() * 255), 
			Math.floor(Math.random() * 255), 
			Math.floor(Math.random() * 255)
		);
		LedManager.sendLeds();
	}, 100);
};

exports.setColor = function(color, x = BRIGHTNESS_MAX) {
	setup();
	for (let i = 0; i < LEDS_COUNT; i++) {
		LedManager.setLedColor(i, Math.min(x, BRIGHTNESS_MAX), color[0], color[1], color[2]);
	}
	LedManager.sendLeds();
};

exports.off = function() {
	setup();
	for (let i = 0; i < LEDS_COUNT; i++) {
		LedManager.setLedColor(i, 0, 0, 0, 0);
	}
	LedManager.sendLeds();
};

// setLedColor(n, brightness 0-31, red 0-255, green 0-255, blue 0-255)
exports._setLedColor = LedManager.setLedColor;
exports._sendLeds = LedManager.sendLeds;