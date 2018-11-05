const mongoose = require('mongoose');

mongoose.connectDefault = function() {
	mongoose.connect('mongodb://' + config.mongo.user + ':' + config.mongo.password + '@' + config.mongo.host + ':' + config.mongo.port + '/' + config.mongo.database, { useNewUrlParser: true });
};

module.exports = mongoose;