import { AIRuntimeFunction } from "../../types";
import camera from "../../stdlib/camera";

export const authorizations = ["camera"];

const takePhoto: AIRuntimeFunction<null> = async () => {
  return { image: await camera().takePhoto(), analytics: { engine: "action" } };
};

export default takePhoto;
