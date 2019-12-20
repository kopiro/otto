const util = require("util");
const { baseDir } = require("../paths");
const { rand } = require("../helpers");

const TAG = "Messages";

// TODO : refactor
const library = require(`${baseDir}/messages.json`) || {};

function getRaw(key) {
  const str = library[key];
  if (str == null) {
    console.error(TAG, `unable to find the key ${key}`);
    return "";
  }
  return str;
}

function get(key, ...args) {
  const str = getRaw(key);
  return util.format(rand(str), ...args);
}

module.exports = { getRaw, get };
