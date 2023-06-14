import { Camera } from "../../abstracts/camera";
import * as Proc from "../proc";
import { getTmpFile } from "../../helpers";

export class MacOSCamera extends Camera {
  async takePhoto(): Promise<string> {
    const tmpFile = getTmpFile("jpg");
    await Proc.spawn("imagesnap", ["-o", tmpFile]).result;
    return tmpFile;
  }

  async takeVideo(): Promise<string> {
    const tmpFile = getTmpFile("mp4");
    await Proc.spawn("ffmpeg", [
      "-f",
      "avfoundation",
      "-framerate",
      "30",
      "-i",
      "0",
      "-t",
      5,
      "-target",
      "pal-vcd",
      "-vcodec",
      "libx264",
      tmpFile,
    ]).result;
    return tmpFile;
  }
}
