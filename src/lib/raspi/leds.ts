// @ts-ignore
import Apa102spi from "apa102-spi";

import { Signale } from "signale";

const TAG = "Camera";
const logger = new Signale({
  scope: TAG,
});

const BRIGHTNESS_MAX = 30;
const LEDS_COUNT = 3;

const LedManager = new Apa102spi(3, 100);

export function setColor(color: number[], x = BRIGHTNESS_MAX) {
  for (let i = 0; i < LEDS_COUNT; i++) {
    LedManager.setLedColor(i, Math.min(x, BRIGHTNESS_MAX), color[0], color[1], color[2]);
  }
  LedManager.sendLeds();
}

export function off() {
  for (let i = 0; i < LEDS_COUNT; i++) {
    LedManager.setLedColor(i, 0, 0, 0, 0);
  }
  LedManager.sendLeds();
}
