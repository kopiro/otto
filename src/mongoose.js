const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

mongoose.connectDefault = function() {
	mongoose.connect('mongodb://' + config.mongo.user + ':' + config.mongo.password + '@' + config.mongo.host + ':' + config.mongo.port + '/' + config.mongo.database);
};

module.exports = mongoose;