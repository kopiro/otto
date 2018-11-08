const TAG = 'Wunderground';

const _config = config.wunderground;
const rp = require('request-promise');

const DOMAIN = 'http://api.wunderground.com/api/' + _config.apiKey;
const AC_DOMAIN = 'http://autocomplete.wunderground.com/aq';

exports.api = async function(opt) {
	let url = `${DOMAIN}/${opt.type}/lang:${config.language.toUpperCase()}/q/IT/${
		opt.location
	}.json`;
	return rp({
		url: url,
		json: true
	});
};
