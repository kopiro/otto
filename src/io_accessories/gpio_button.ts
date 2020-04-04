import rpio from "rpio";
import config from "../config";

export const id = "gpio_button";

exports.start = io => {
  rpio.open(config().gpio_button.pin, rpio.INPUT, rpio.PULL_UP);
  rpio.poll(config().gpio_button.pin, pin => {
    const pressed = rpio.read(pin);
    if (pressed) {
      io.emitter.emit("wake");
    }
  });
};
