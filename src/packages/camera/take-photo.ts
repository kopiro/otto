import { AIAction } from "../../types";
import camera from "../../stdlib/camera";
import { Authorizations } from "../../stdlib/iomanager";

export const authorizations = [Authorizations.CAMERA];

const cameraAction: AIAction = async () => {
  return { image: await camera().takePhoto() };
};

export default cameraAction;
