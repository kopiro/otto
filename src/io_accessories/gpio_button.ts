import config from "../config";
import { IOAccessoryModule, IODriverModule } from "../stdlib/iomanager";

export const id = "gpio_button";

class GPIOButton implements IOAccessoryModule {
  driver: IODriverModule;

  constructor(driver: IODriverModule) {
    this.driver = driver;
  }

  start() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rpio = require("rpio");
    rpio.open(config().gpio_button.pin, rpio.INPUT, rpio.PULL_UP);
    rpio.poll(config().gpio_button.pin, (pin) => {
      const pressed = rpio.read(pin);
      if (pressed) {
        this.driver.emitter.emit("wake");
      }
    });
  }
}

export default GPIOButton;
