exports.id = 'geo.capital';

const rp = require('request-promise');
const Translator = apprequire('translator');

module.exports = async function({ sessionId, result }) {
	let { parameters: p, fulfillment } = result;

	const country_en = await Translator.translate(p.country, 'en');
	const info = await rp('https://restcountries.eu/rest/v2/name/' + country_en, {
		json: true
	});

	if (info == null || info[0] == null) {
		throw { genericError: true };
	}

	return {
		speech: fulfillment.speech.replace('$_capital', info[0].capital)
	};
};