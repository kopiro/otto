exports.id = 'translate.text';

const _ = require('underscore');

const Translator = apprequire('translator');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		const { parameters: p, fulfillment } = result;

		const languages = await Translator.getLanguages(config.language);
		const language = _.findWhere(languages, { name: p.language });
		if (language == null) {
			return reject({
				speech: 'Purtroppo non conosco questa lingua'
			});
		}

		const text = await Translator.translate(p.q, language.code);
		resolve({
			speech: text,
			data: {
				language: language.code
			}
		});
	});
};