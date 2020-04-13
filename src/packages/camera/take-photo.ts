import { AIAction, Fulfillment } from "../../types";
import Camera from "../../stdlib/camera";

export default (async function takePhoto(): Promise<Fulfillment> {
  const photo = await Camera.takePhoto();
  return {
    payload: {
      image: {
        uri: photo,
      },
    },
  };
} as AIAction);
