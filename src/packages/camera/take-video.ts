import { AIAction, Fulfillment } from "../../types";
import camera from "../../stdlib/camera";
import { Authorizations } from "../../stdlib/iomanager";

export const authorizations = [Authorizations.CAMERA];

const takeVideo: AIAction = async () => {
  return { video: await camera().takeVideo() };
};

export default takeVideo;
