import * as Proc from "../../stdlib/proc";
import { ICamera } from "../../stdlib/camera";
import { File } from "../../stdlib/file";

export class MacOSCamera implements ICamera {
  async takePhoto(): Promise<File> {
    const tmpFile = File.getTmpFile("jpg");
    await Proc.processSpawn("imagesnap", ["-o", tmpFile.getAbsolutePath()]).result;
    return tmpFile;
  }

  async takeVideo(): Promise<File> {
    const tmpFile = File.getTmpFile("mp4");
    await Proc.processSpawn("ffmpeg", [
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
      tmpFile.getAbsolutePath(),
    ]).result;
    return tmpFile;
  }
}
