import { gpioButtonStart } from "../lib/raspi/gpio";
import { IOAccessoryModule, IODriverRuntime } from "../stdlib/io-manager";

export const id = "gpio_button";

class GPIOButton implements IOAccessoryModule {
  constructor(private driver: IODriverRuntime) {}

  start() {
    gpioButtonStart(() => {
      this.driver.emitter.emit("wake");
    });
  }
}

export default GPIOButton;
