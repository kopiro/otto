const TAG = 'Raspi/Leds';

const BRIGHTNESS_MAX = 30;
const LEDS_COUNT = 3;

let Apa102spi;
let LedManager;

try {
  // Apa102spi(number of leds, clock divider)
  // The clock divider argument is an even divisor of the base 250MHz rate ranging between 0 and 65536.
  Apa102spi = require('apa102-spi');
  LedManager = new Apa102spi(3, 100);
} catch (err) {
  console.error(TAG, 'Platform not supported');
  const noop = () => {};
  LedManager = {
    setLedColor: noop,
    sendLeds: noop,
  };
}

function setColor(color, x = BRIGHTNESS_MAX) {
  for (let i = 0; i < LEDS_COUNT; i++) {
    LedManager.setLedColor(i, Math.min(x, BRIGHTNESS_MAX), color[0], color[1], color[2]);
  }
  LedManager.sendLeds();
}

function off() {
  for (let i = 0; i < LEDS_COUNT; i++) {
    LedManager.setLedColor(i, 0, 0, 0, 0);
  }
  LedManager.sendLeds();
}

module.exports = {
  setColor,
  off,
};
