import { AIAction, Fulfillment } from "../../types";
import Camera from "../../stdlib/camera";
import { Authorizations } from "../../stdlib/iomanager";

export const authorizations = [Authorizations.CAMERA];

export default (async function takePhoto(): Promise<Fulfillment> {
  const uri = await Camera.takeVideo();
  return {
    payload: {
      video: {
        uri,
      },
    },
  };
} as AIAction);
