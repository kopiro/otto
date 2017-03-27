exports.id = 'translate.text';

const Translator = apprequire('translator');

module.exports = function({ sessionId, result }) {
	console.log(result);
	return new Promise((resolve, reject) => {
		const { parameters: p, fulfillment } = result;
		const lang = Util.getLocaleFromString(p.language);

		Translator.translate(p.q, lang, (err, translation) => {
			if (err) {
				console.error(exports.id, err);
				return reject();
			}
			
			resolve({
				speech: translation,
				data: {
					speech: {
						language: lang
					}
				}
			});
		});
	});
};