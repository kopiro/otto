import moment from "moment";
import config from "../config";

let _instance: typeof moment;
export default (): typeof moment => {
  if (!_instance) {
    _instance = moment;
    _instance.locale(config().language);
  }
  return _instance;
};
