exports.id = 'translate.text';

const Translator = apprequire('translator');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		const { parameters: p, fulfillment } = result;

		const languages = JSON.parse(fs.readFileSync(__basedir + '/etc/languages.json'));
		let lang = null;

		for (let lang_iso in languages) {
			if (languages.hasOwnProperty(lang_iso)) {
				if (languages[lang_iso].toLowerCase() == p.language.toLowerCase()) {
					lang = lang_iso;
				}
			}
		}
	
		Translator.translate(p.q, lang || config.language, (err, translation) => {
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