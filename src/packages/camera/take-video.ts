import { Fulfillment } from "../../types";
import camera from "../../stdlib/camera";
import { Authorizations } from "../../stdlib/iomanager";

export const authorizations = [Authorizations.CAMERA];

export default async (): Promise<Fulfillment> => {
  const uri = await camera().takeVideo();
  return {
    payload: {
      video: {
        uri,
      },
    },
  };
};
