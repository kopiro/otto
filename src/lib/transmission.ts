import Transmission from "transmission";
import config from "../config";

export default new Transmission(config().transmission);
