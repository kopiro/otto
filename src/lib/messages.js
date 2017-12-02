const TAG = 'Messages';

const _ = require('underscore');
const util = require('util');
const library = _.extend({}, requireOrNull(__basedir + '/messages.json'), requireOrNull(__basedir + '/messages-custom.json'));

exports.get = function(key, ...args) {
	let str = library[key];
	if (str == null) {
		console.error(TAG, `unable to find the key ${str}`);
		return "";
	}

	str = _.isArray(str) ? str.getRandom() : str;
	return util.format(str, ...args);	
};
