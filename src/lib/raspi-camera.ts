import { Camera } from "../abstracts/camera";
import * as Proc from "./proc";
import { getTmpFile } from "../helpers";

export class RaspiCamera extends Camera {
  async takePhoto(): Promise<string> {
    const tmpFile = getTmpFile("jpg");
    await Proc.spawn("raspistill", ["-o", tmpFile]);
    return tmpFile;
  }
}
