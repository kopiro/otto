const Transmission = require("transmission");
const config = require("../config");

const _config = config.transmission;
module.exports = new Transmission(_config);
