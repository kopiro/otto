import { AIRuntimeFunction } from "../../types";
import { Camera } from "../../stdlib/camera";

export const authorizations = ["camera"];

const takeVideo: AIRuntimeFunction<null> = async () => {
  const video = await Camera.getInstance().takeVideo();
  return { video: video.getAbsolutePath() };
};

export default takeVideo;
