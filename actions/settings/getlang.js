exports.id = 'settings.switchlang';

module.exports = function({ sessionId, result }, session_model) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		let from = Util.getStringFromLanguageCode(session_model.get('translate_from'));
		let to = Util.getStringFromLanguageCode(session_model.get('translate_to'));

		resolve({
			speech: `Ti sto parlando in ${to}, tu mi parli in ${from}`
		});
	});
};