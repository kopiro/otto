import util from "util";
import { rand } from "../helpers";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const library = require("../../messages.json");

const TAG = "Messages";

// TODO : refactor

export function getRaw(key) {
  const str = library[key];
  if (str == null) {
    console.error(TAG, `unable to find the key ${key}`);
    return "";
  }
  return str;
}

export function get(key, ...args) {
  const str = getRaw(key);
  return util.format(rand(str), ...args);
}
