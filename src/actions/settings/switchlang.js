exports.id = 'settings.switchlang';

const _ = require('underscore');
const levenshtein = require('fast-levenshtein');

const Translator = apprequire('translator');

module.exports = async function({ sessionId, result }, session) {
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

		let preferred_lang = { distance: 999, code: null, name: null };

		for (let l of languages) {
			const lev = levenshtein.get(l.name.toUpperCase(), language_request.toUpperCase());
			if (lev < 4 && preferred_lang.distance > lev) {
				preferred_lang = {
					distance: lev,
					code: l.code,
					name: l.name
				};
			}
		}

		if (preferred_lang.code == null) {
			throw fulfillment.payload.errors.unknownLanguage;
		}

		let language_to_set = preferred_lang.code;
		if (language_to_set == config.language) language_to_set = null;
		session['translate_' + x] = language_to_set;
	}

	await session.save();

	const from = _.findWhere(languages, { code: session.getTranslateFrom() }).name;
	const to = _.findWhere(languages, { code: session.getTranslateTo() }).name;

	if (session.getTranslateFrom() === session.getTranslateTo()) {
		return {
			speech: fulfillment.payload.speech.single.replace('$_language', from)
		};
	} else {
		return {
			speech: fulfillment.payload.speech.plural
					.replace('$_from', from)
					.replace('$_to', to)
		};
	}
};