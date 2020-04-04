import moment from "moment";
import config from "../config";

moment.locale(config().language);
export default moment;
