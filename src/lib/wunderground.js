const TAG = 'wunderground';

const _config = config.ai.wunderground;
const request = require('fs');

exports.api = function(opt, callback) {
	let url = [
	'http://api.wunderground.com/api/', _config.apiKey, 
	'/', opt.type, 
	'/lang:' + config.language.toUpperCase(),
	'/q', 
	'/', opt.state || _config.state, 
	'/', opt.city || _config.city, 
	'.json'
	].join('');
	request({
		url: url,
		json: true
	}, function(error, response, body) {
		console.debug(TAG, url);
		if (callback) callback(error, body);
	});
};