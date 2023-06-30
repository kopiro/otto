// @ts-ignore
import rpio from "rpio";
import config from "../../config";

export function gpioButtonStart(callback: () => void) {
  const { gpioButton } = config();
  rpio.open(gpioButton.pin, rpio.INPUT, rpio.PULL_UP);
  rpio.poll(gpioButton.pin, (pin: string) => {
    const pressed = rpio.read(pin);
    if (pressed) {
      callback();
    }
  });
}
