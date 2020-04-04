import FB from "fb";
import config from "../config";

const _ = new FB.Facebook(config().facebook);
_.config = config().facebook;

export default _;
