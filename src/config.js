const assignDeep = require("assign-deep");

const configFilePath = process.env.CONFIG_FILE || `${__dirname}/../config.json`;
console.info("Using config file :", configFilePath);

module.exports = assignDeep(
  require("../default-config.json"),
  require(configFilePath)
);
