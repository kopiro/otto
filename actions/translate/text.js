exports.id = 'translate.text';

const Translator = apprequire('translator');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		const { parameters: p, fulfillment } = result;
		const language = Util.getLocaleFromString(p.language);

		Translator.translate(p.q, language, (err, translation) => {
			if (err) {
				console.error(exports.id, err);
				return reject();
			}
			
			resolve({
				speech: translation,
				data: {
					speech: {
						language: language
					}
				}
			});
		});
	});
};