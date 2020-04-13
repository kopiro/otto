import { Camera } from "../abstracts/camera";
import * as Proc from "./proc";
import { getTmpFile } from "../helpers";

export class MacOSCamera extends Camera {
  async takePhoto(): Promise<string> {
    const tmpFile = getTmpFile("jpg");
    await Proc.spawn("imagesnap", ["-o", tmpFile]);
    return tmpFile;
  }
}
