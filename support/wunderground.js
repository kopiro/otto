const _config = config.ai.wunderground;
const TAG = path.basename(__filename, '.js');

exports.api = function(opt, callback) {
	let url = [
	'http://api.wunderground.com/api/', _config.apiKey, 
	'/', opt.type, 
	'/lang:' + config.language,
	'/q', 
	'/', opt.state || 'IT', 
	'/', opt.city, 
	'.json'
	].join('');
	request({
		url: url,
		json: true,
		headers: {
			'Ocp-Apim-Subscription-Key': _config.apiKey
		}
	}, function(error, response, body) {
		console.debug(TAG, 'result', body);
		if (callback) callback(error, body);
	});
};