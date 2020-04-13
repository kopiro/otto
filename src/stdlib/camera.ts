import { RaspiCamera } from "../lib/raspi-camera";
import isPi from "detect-rpi";
import { MacOSCamera } from "../lib/macos-camera";

const TAG = "Camera";

export default (() => {
  switch (true) {
    case isPi():
      return new RaspiCamera();
    case process.platform === "darwin":
      return new MacOSCamera();
    default:
      throw new Error(`${TAG}: no driver available for this platform`);
  }
})();
