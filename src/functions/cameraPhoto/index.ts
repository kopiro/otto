import { AIRuntimeFunction } from "../../types";
import { Camera } from "../../stdlib/camera";

export const authorizations = ["camera"];

const takePhoto: AIRuntimeFunction<null> = async () => {
  const photo = await Camera.getInstance().takePhoto();
  return { image: photo.getAbsolutePath(), analytics: { engine: "action" } };
};

export default takePhoto;
