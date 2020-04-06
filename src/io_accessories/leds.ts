import * as RaspiLeds from "../lib/raspi/leds";
import { IODriverModule, IOAccessoryModule } from "../stdlib/iomanager";

export const id = "leds";

const colorForRecognizing = [0, 255, 0];
const colorForOutput = [255, 0, 0];
const colorForThinking = [255, 255, 0];

class Leds implements IOAccessoryModule {
  driver: IODriverModule;

  constructor(driver: IODriverModule) {
    this.driver = driver;
  }

  start() {
    RaspiLeds.off();

    this.driver.emitter.on("input", () => {
      RaspiLeds.setColor(colorForThinking);
    });

    this.driver.emitter.on("output", () => {
      RaspiLeds.setColor(colorForOutput);
    });

    this.driver.emitter.on("thinking", () => {
      RaspiLeds.setColor(colorForThinking);
    });

    this.driver.emitter.on("recognizing", () => {
      RaspiLeds.setColor(colorForRecognizing);
    });

    this.driver.emitter.on("notrecognizing", () => {
      RaspiLeds.off();
    });

    this.driver.emitter.on("stopped", () => {
      RaspiLeds.off();
    });
  }
}
export default Leds;
