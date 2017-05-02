exports.id = 'translate.text';

const Translator = apprequire('translator');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		const { parameters: p, fulfillment } = result;

		Translator.getLanguages(config.language, (err, avail_langs) => {
			if (err) return reject(err);

			const language = _.findWhere(avail_langs, { name: p.language });
			if (language == null) {
				return reject({
					speech: 'Purtroppo non conosco questa lingua'
				});
			}
			
			Translator.translate(p.q, language.code, (err, translation) => {
				if (err) return reject(err);

				resolve({
					speech: translation,
					data: {
						language: language.code
					}
				});
			});
		});
	});
};