import { AIAction } from "../../types";
import camera from "../../stdlib/camera";
import { Authorizations } from "../../stdlib/iomanager";

export const authorizations = [Authorizations.CAMERA];

const takePhoto: AIAction = async () => {
  return { image: await camera().takePhoto(), analytics: { engine: "action" } };
};

export default takePhoto;
