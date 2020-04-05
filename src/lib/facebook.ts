import FB from "fb";
import config from "../config";

const _client = new FB.Facebook(config().facebook);
_client.config = config().facebook;

export const client = _client;
