const TAG = 'Raspi/Leds';

const _ = require('underscore');
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

exports.doFullGradient = function() {
	function* circularRGBGenerator() {
		let r = 0, g = 0, b = 0;
		while (r < 255) yield [ r++, 0, 0 ];
		while (g < 255) yield [ r--, g++, 0 ];
		while (b < 255) yield [ 0, g--, b++ ];
		while (r < 255) yield [ r++, 0, b-- ];
		while (g < 255) yield [ r, g++, 0 ];
		while (b < 255) yield [ r, g, b++ ];
		while (r >= 0) yield [ r--, g--, b-- ];
		return null;
	}
	let gen = circularRGBGenerator();
	(function x() {
		const v = gen.next().value;
		if (v == null) return;
		exports.setColor(v[0], v[1], v[2]);
		setTimeout(x, 1);
	})();
};

function interpolateColor(color1, color2, factor) {
	var result = color1.slice();
	for (var i = 0; i < 3; i++) {
		result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
	}
	return result;
}

exports.setViaTimeline = function(timeline, method = 'setColor') {
	_.each(timeline, (values, time) => {
		setTimeout(() => {
			exports[method](...values);
		}, +time);
	});
};

var LedAnimator = function(ticker) {
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
	}, 10);
};

exports.animateRandom = function() {
	return new LedAnimator(() => {
		LedManager.setLedColor(
			Math.floor(Math.random() * LEDS_COUNT), 
			BRIGHTNESS_MAX, 
			Math.floor(Math.random() * 255), 
			Math.floor(Math.random() * 255), 
			Math.floor(Math.random() * 255)
		);
		LedManager.sendLeds();
	});
};

exports.setColor = function(color, x = BRIGHTNESS_MAX) {
	for (let i = 0; i < LEDS_COUNT; i++) {
		LedManager.setLedColor(i, Math.min(x, BRIGHTNESS_MAX), color[0], color[1], color[2]);
	}
	LedManager.sendLeds();
};

exports.off = function() {
	for (let i = 0; i < LEDS_COUNT; i++) {
		LedManager.setLedColor(i, 0, 0, 0, 0);
	}
	LedManager.sendLeds();
};

// setLedColor(n, brightness 0-31, red 0-255, green 0-255, blue 0-255)
exports._setLedColor = LedManager.setLedColor;
exports._sendLeds = LedManager.sendLeds;