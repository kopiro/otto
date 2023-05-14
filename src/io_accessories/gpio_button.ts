import config from "../config";
import { gpioButtonStart } from "../lib/raspi/gpio";
import { IOAccessoryModule, IODriverModule } from "../stdlib/iomanager";

export const id = "gpio_button";

class GPIOButton implements IOAccessoryModule {
  driver: IODriverModule;

  constructor(driver: IODriverModule) {
    this.driver = driver;
  }

  start() {
    gpioButtonStart(() => {
      this.driver.emitter.emit("wake");
    });
  }
}

export default GPIOButton;
