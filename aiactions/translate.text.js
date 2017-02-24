const TAG = path.basename(__filename, '.js');

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);

		let { parameters } = e;
		let lang_iso_code;

		if (parameters.to) {
			lang_iso_code = parameters.to.langCode;
		} else {
			lang_iso_code = 'it';
		}

		Translator.translate(parameters.text, lang_iso_code, (err, translation) => {
			console.debug(TAG, 'result', translation);

			if (err) {
				console.error(TAG, translation);
				return reject({
					err: err,
					text: 'Scusami, ma non riesco a tradurre questo per te'
				});
			}

			resolve({
				text: translation
			});
		});
	});
};