const TAG = 'AI.translate';

const translate = require('@google-cloud/translate');
const translator = translate({
	keyFilename: __basedir + '/gcloud.json'
});

const LANGUAGES = _.invert(require(__basedir + '/etc/languages.json'));

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, JSON.stringify(e, null, 2));
		let { parameters } = e;

		let lang_iso_code = LANGUAGES[parameters.language.trim().toLowerCase()];
		if (lang_iso_code == null) {
			return reject({
				text: 'Scusami, ma non capisco la lingua nella quale vorresti tradurre (' + parameters.language + ')'
			});
		}

		translator.translate(parameters.to_translate, lang_iso_code, function(err, translation) {
			if (err) {
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