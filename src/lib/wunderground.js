const TAG = 'Wunderground';

const _config = config.wunderground;
const request = require('request-promise');

exports.api = function (opt) {
	let url = [
		'http://api.wunderground.com/api/', _config.apiKey,
		'/', opt.type,
		'/lang:' + config.language.toUpperCase(),
		'/q',
		'/', opt.state,
		'/', opt.city,
		'.json'
	].join('');

	return request({
		url: url,
		json: true
	});
};