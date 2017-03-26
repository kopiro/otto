exports.id = 'translate.text';

const Translator = require(__basedir + '/support/translator');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		
		let lang_iso_code;

		if (p.to) lang_iso_code = p.to.langCode;
		else lang_iso_code = config.language;

		Translator.translate(p.text, lang_iso_code, (err, translation) => {
			if (err) {
				return reject();
			}

			resolve(translation);
		});
	});
};