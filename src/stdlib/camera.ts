import { RaspiCamera } from "../lib/raspi-camera";
import isPi from "detect-rpi";
import { MacOSCamera } from "../lib/macos-camera";
import { Camera } from "../abstracts/camera";
import { Signale } from "signale";

const TAG = "Camera";
const console = new Signale({
  scope: TAG,
});

let _instance: Camera;
export default () => {
  if (!_instance) {
    switch (true) {
      case isPi():
        _instance = new RaspiCamera();
        break;
      case process.platform === "darwin":
        _instance = new MacOSCamera();
        break;
      default:
        throw new Error(`${TAG}: no driver available for this platform`);
    }
  }
  return _instance;
};
