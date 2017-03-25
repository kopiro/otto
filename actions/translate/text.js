exports.id = 'translate.text';

const Translator = require(__basedir + '/support/translator');

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(exports.id, e);

		let { parameters:p } = e;
		let lang_iso_code;

		if (p.to) lang_iso_code = p.to.langCode;
		else lang_iso_code = config.language;

		Translator.translate(p.text, lang_iso_code, (err, translation) => {
			if (err) {
				return resolve({
					text: 'Scusa, ma non riesco a tradurre questo per te'
				});
			}

			resolve(translation);
		});
	});
};