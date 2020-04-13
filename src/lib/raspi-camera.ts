import { Camera } from "../abstracts/camera";
import * as Proc from "./proc";
import { getTmpFile } from "../helpers";

export class RaspiCamera extends Camera {
  async takePhoto(): Promise<string> {
    const tmpFile = getTmpFile("jpg");
    await Proc.spawn("raspistill", ["-o", tmpFile]);
    return tmpFile;
  }
  async takeVideo(time = 5): Promise<string> {
    const tmpFileH264 = getTmpFile("h264");
    const tmpFileAudio = getTmpFile("wav");
    await Promise.all([
      Proc.spawn("raspivid", ["-t", time * 1000, "-o", tmpFileH264]),
      Proc.spawn("arecord", ["-d", time, "-c", "2", "-f", "s16_LE", "-r", 8000, tmpFileAudio]),
    ]);
    const tmpFileVideo = getTmpFile("mp4");
    await Proc.spawn("ffmpeg", [
      "-y",
      "-i",
      tmpFileAudio,
      "-i",
      tmpFileH264,
      "-filter:a",
      "aresample=async=1",
      "-c:a",
      "flac",
      "-c:v",
      "copy",
      "-strict",
      "-2",
      tmpFileVideo,
    ]);
    return tmpFileVideo;
  }
}
