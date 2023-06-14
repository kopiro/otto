import { RaspiCamera } from "../lib/camera/raspi-camera";
import { MacOSCamera } from "../lib/camera/macos-camera";
import { Camera } from "../abstracts/camera";
import { Signale } from "signale";
import { getPlatform } from "./platform";

const TAG = "Camera";

let _instance: Camera;
export default () => {
  if (!_instance) {
    switch (getPlatform()) {
      case "pi":
        _instance = new RaspiCamera();
        break;
      case "macos":
        _instance = new MacOSCamera();
        break;
      default:
        throw new Error(`${TAG}: no driver available for this platform`);
    }
  }
  return _instance;
};
