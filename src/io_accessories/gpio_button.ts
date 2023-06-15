import { gpioButtonStart } from "../lib/raspi/gpio";
import { IOAccessoryModule, IODriverRuntime } from "../stdlib/iomanager";

export const id = "gpio_button";

class GPIOButton implements IOAccessoryModule {
  driver: IODriverRuntime;

  constructor(driver: IODriverRuntime) {
    this.driver = driver;
  }

  start() {
    gpioButtonStart(() => {
      this.driver.emitter.emit("wake");
    });
  }
}

export default GPIOButton;
