const FB = require("fb");
const config = require("../config");

module.exports = new FB.Facebook(config.facebook);
module.exports.config = config.facebook;
