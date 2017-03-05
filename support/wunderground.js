const _config = config.ai.wunderground;
const TAG = path.basename(__filename, '.js');

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
		console.debug(TAG, body);
		if (callback) callback(error, body);
	});
};