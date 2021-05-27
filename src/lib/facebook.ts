import FB from "fb";
import config from "../config";

let _instance: typeof FB;
export default (): typeof _instance => {
  if (!_instance) {
    _instance = new FB.Facebook(config().facebook);
  }
  return _instance;
};
