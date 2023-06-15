import moment from "moment";
import config from "../config";

let instance: typeof moment | undefined;

export function Moment(): typeof moment {
  if (!instance) {
    instance = moment;
    instance.locale(config().language);
  }
  return instance;
}
