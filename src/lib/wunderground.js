const TAG = 'Wunderground';

const _config = config.wunderground;
const request = require('request');

exports.api = function(opt, callback) {
	return new Promise((resolve, reject) => {
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
		}, (err, response, body) => {
			if (err) return reject(err);
			resolve(body);
		});
	});
};