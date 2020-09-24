import { Fulfillment } from "../../types";
import Camera from "../../stdlib/camera";
import { Authorizations } from "../../stdlib/iomanager";

export const authorizations = [Authorizations.CAMERA];

const main = async (): Promise<Fulfillment> => {
  const uri = await Camera.takePhoto();
  return {
    payload: {
      image: {
        uri,
      },
    },
  };
};

export default main;
