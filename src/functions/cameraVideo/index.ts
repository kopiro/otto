import { AIRuntimeFunction } from "../../types";
import camera from "../../stdlib/camera";

export const authorizations = ["camera"];

const takeVideo: AIRuntimeFunction<null> = async () => {
  return { video: await camera().takeVideo(), analytics: { engine: "action" } };
};

export default takeVideo;
