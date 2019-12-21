const fs = require("fs");
const assignDeep = require("assign-deep");
const path = require("path");
const { keysDir } = require("./paths");

const configFilePath =
  process.env.CONFIG_FILE || path.join(keysDir, "config.json");

const config = assignDeep(
  JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "default-config.json"), "utf8")
  ),
  JSON.parse(fs.readFileSync(configFilePath, "utf8"))
);
console.info("Using config file :", configFilePath);

module.exports = config;
