import * as Proc from "../../stdlib/proc";
import { ICamera } from "../../stdlib/camera";
import { File } from "../../stdlib/file";

export class RaspiCamera implements ICamera {
  async takePhoto(): Promise<File> {
    const tmpFile = File.getTmpFile("jpg");
    await Proc.processSpawn("raspistill", ["-o", tmpFile.getAbsolutePath(), "-ex", "auto"]).result;
    return tmpFile;
  }

  async takeVideo(time = 5): Promise<File> {
    const tmpFileH264 = File.getTmpFile("h264");
    const tmpFileAudio = File.getTmpFile("wav");
    const tmpFileVideo = File.getTmpFile("mp4");

    await Promise.all([
      Proc.processSpawn("arecord", ["-d", time, "-c", "2", "-f", "s16_LE", "-r", 8000, tmpFileAudio.getAbsolutePath()])
        .result,
      Proc.processSpawn("raspivid", ["-t", time * 1000, "-o", tmpFileH264.getAbsolutePath()]).result,
    ]);

    await Proc.processSpawn("ffmpeg", [
      "-y",
      "-i",
      tmpFileAudio.getAbsolutePath(),
      "-i",
      tmpFileH264.getAbsolutePath(),
      "-filter:a",
      "aresample=async=1",
      "-c:a",
      "flac",
      "-c:v",
      "copy",
      "-strict",
      "-2",
      tmpFileVideo.getAbsolutePath(),
    ]).result;

    return tmpFileVideo;
  }
}
