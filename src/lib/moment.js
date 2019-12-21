const moment = require("moment");
const config = require("../config");

moment.locale(config.language);
module.exports = moment;
