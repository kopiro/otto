/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-unresolved */
exports.id = "gpio_button";

const rpio = require("rpio");
const config = require("../config");

exports.start = io => {
  rpio.open(config.gpio_button.pin, rpio.INPUT, rpio.PULL_UP);
  rpio.poll(config.gpio_button.pin, pin => {
    const pressed = rpio.read(pin);
    if (pressed) {
      io.emitter.emit("wake");
    }
  });
};
