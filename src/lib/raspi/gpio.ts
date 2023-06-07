// @ts-ignore
import rpio from "rpio";
import config from "../../config";

export function gpioButtonStart(callback: () => void) {
  rpio.open(config().gpio_button.pin, rpio.INPUT, rpio.PULL_UP);
  rpio.poll(config().gpio_button.pin, (pin: string) => {
    const pressed = rpio.read(pin);
    if (pressed) {
      callback();
    }
  });
}
