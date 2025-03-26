import { AIRuntimeFunction } from "../../dtypes";
import { Camera } from "../../stdlib/camera";

export const authorizations = ["camera"];

const takePhoto: AIRuntimeFunction<null> = async () => {
  const photo = await Camera.getInstance().takePhoto();
  return { image: photo.getAbsolutePath() };
};

export default takePhoto;
