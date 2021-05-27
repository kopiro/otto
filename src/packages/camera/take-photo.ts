import { AIAction, Fulfillment } from "../../types";
import camera from "../../stdlib/camera";
import { Authorizations } from "../../stdlib/iomanager";

export const authorizations = [Authorizations.CAMERA];

const cameraAction: AIAction = async () => {
  const uri = await camera().takePhoto();
  return {
    payload: {
      image: {
        uri,
      },
    },
  };
};

export default cameraAction;
