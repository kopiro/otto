exports.id = 'settings.switchlang';

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		config.language = Util.getLocaleFromString(p.language);
		config.locale = Util.getLocaleFromLanguageCode(config.language);
		config.translateSpeech = true;
		config.translateText = true;

		return resolve({
			speech: "Ok!"
		});
	});
};