const assignDeep = require('assign-deep');
module.exports = assignDeep(require('../default-config.json'), require('../config.json'));
