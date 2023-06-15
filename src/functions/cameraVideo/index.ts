import { AIRuntimeFunction } from "../../types";
import { Camera } from "../../stdlib/camera";

export const authorizations = ["camera"];

const takeVideo: AIRuntimeFunction<null> = async () => {
  const video = await Camera.getInstance().takeVideo();
  return { video: video.getAbsolutePath(), analytics: { engine: "action" } };
};

export default takeVideo;
