exports.id = 'gpio_button';
const rpio = require('rpio');
const config = require('../config');

exports.canHandleOutput = () => false;

exports.attach = (io) => {
  rpio.open(config.gpio_button.pin, rpio.INPUT, rpio.PULL_UP);
  rpio.poll(config.gpio_button.pin, (pin) => {
    const pressed = rpio.read(pin);
    if (pressed) {
      io.emitter.emit('wake');
    }
  });
};
