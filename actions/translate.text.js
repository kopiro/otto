const TAG = path.basename(__filename, '.js');

const Translator = require(__basedir + '/support/translator');

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);

		let { parameters:p } = e;
		let lang_iso_code;

		if (p.to) {
			lang_iso_code = p.to.langCode;
		} else {
			lang_iso_code = config.language;
		}

		Translator.translate(p.text, lang_iso_code, (err, translation) => {
			if (err) {
				err.text = 'Scusami, ma non riesco a tradurre questo per te';
				return reject(err);
			}

			resolve(translation);
		});
	});
};