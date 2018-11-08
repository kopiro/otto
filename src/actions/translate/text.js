exports.id = 'translate.text';

const _ = require('underscore');
const Translator = apprequire('translator');

module.exports = async function({ queryResult }, session) {
	let { parameters: p } = queryResult;

	const languages = await Translator.getLanguages(config.language);
	const language = _.findWhere(languages, { name: p.language });
	if (language == null) {
		throw 'unknown_language';
	}

	const text = await Translator.translate(p.q, language.code);
	return {
		fulfillmentText: text,
		payload: {
			includeVoice: true,
			language: language.code
		}
	};
};
