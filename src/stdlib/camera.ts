import { RaspiCamera } from "../lib/camera/raspi-camera";
import { MacOSCamera } from "../lib/camera/macos-camera";
import { Signale } from "signale";
import { getPlatform } from "./platform";
import { File } from "./file";

const TAG = "Camera";
const logger = new Signale({
  scope: TAG,
});

export interface ICamera {
  takePhoto(): Promise<File>;
  takeVideo(): Promise<File>;
}

export class Camera {
  private static instance: ICamera;
  public static getInstance(): ICamera {
    if (!Camera.instance) {
      switch (getPlatform()) {
        case "pi":
          Camera.instance = new RaspiCamera();
          break;
        case "macos":
          Camera.instance = new MacOSCamera();
          break;
        default:
          throw new Error(`${TAG}: no driver available for this platform`);
      }
    }
    return Camera.instance;
  }
}
