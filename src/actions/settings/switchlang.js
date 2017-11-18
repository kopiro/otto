exports.id = 'settings.switchlang';

const _ = require('underscore');
const Translator = apprequire('translator');

module.exports = function({ sessionId, result }, session_model) {
	return new Promise(async(resolve, reject) => {
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
				return reject({
					speech: 'Purtroppo non conosco questa lingua'
				});
			}

			let language_to_set = language.code;
			if (language_to_set == config.language) language_to_set = null;
			session_model['translate_' + x] = language_to_set;
		}

		session_model
		.save()
		.then(() => {

			const from = _.findWhere(languages, { code: session_model.translate_from || config.language }).name;
			const to = _.findWhere(languages, { code: session_model.translate_to || config.language }).name;

			resolve({
				speech: `Ok, da ora in poi io ti parlo in ${to}, mentre tu mi parli in ${from}`,
				data: {
					language: session_model.translate_to
				}
			});

		});
	});
};