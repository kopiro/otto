exports.id = 'settings.switchlang';

const _ = require('underscore');
const Translator = apprequire('translator');

module.exports = async function({ sessionId, result }, session_model) {
	let { parameters: p, fulfillment } = result;

	if (p.translate_both) {
		p.translate_from = p.translate_both;
		p.translate_to = p.translate_both;
	}

	// Get languages every time the original language (IT), 
	// because all input requests are translated, and the language is translated too!
	// Example: "ние говорим английски" --> "Parliamo in inglese"
	// So we should request the languages in Italiano to match "inglese"
	let languages = await Translator.getLanguages(config.language);

	for (let x of ['from','to']) {
		let language_request = p['translate_' + x];
		if (language_request == null) continue;

		language_request = language_request.substr(0,1).toUpperCase() + language_request.substr(1);
		const language = _.findWhere(languages, { name: language_request });
		if (language == null) {
			throw fulfillment.payload.errors.unknowLanguage;
		}

		let language_to_set = language.code;
		if (language_to_set == config.language) language_to_set = null;
		session_model['translate_' + x] = language_to_set;
	}

	await session_model.save();

	const from = _.findWhere(languages, { code: session_model.getTranslateFrom() }).name;
	const to = _.findWhere(languages, { code: session_model.getTranslateTo() }).name;

	if (session_model.getTranslateFrom() === session_model.getTranslateTo()) {
		return {
			speech: `Ok, parliamo in ${to}!`
		};
	} else {
		return {
			speech: `Ok, da ora in poi io ti parlo in ${to}, mentre tu mi parli in ${from}`
		};
	}
};