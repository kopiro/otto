const FB = require('fb');
module.exports = new FB.Facebook(config.facebook);
module.exports.config = config.facebook;