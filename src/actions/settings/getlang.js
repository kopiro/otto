exports.id = 'settings.switchlang';

const _ = require('underscore');
const Translator = apprequire('translator');

module.exports = function({ sessionId, result }, session_model) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		const languages = await Translator.getLanguages(config.language);
		const from = _.findWhere(languages, { code: session_model.translate_from || config.language }).name;
		const to = _.findWhere(languages, { code: session_model.translate_to || config.language }).name;

		resolve({
			speech: `Ti sto parlando in ${to}, tu mi parli in ${from}`
		});
	});
};