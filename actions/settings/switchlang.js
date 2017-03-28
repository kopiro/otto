exports.id = 'settings.switchlang';

module.exports = function({ sessionId, result }, session_model) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		if (p.translate_both) {
			p.translate_from = p.translate_both;
			p.translate_to = p.translate_both;
		}

		if (p.translate_to) {
			if ( Util.getLocaleFromString(p.translate_to) != config.language) {
				session_model.set('translate_to', Util.getLocaleFromString(p.translate_to));
			} else {
				session_model.set('translate_to', null);
			}
		}
		
		if (p.translate_from) {
			if ( Util.getLocaleFromString(p.translate_from) != config.language) {
				session_model.set('translate_from', Util.getLocaleFromString(p.translate_from));
			} else {
				session_model.set('translate_from', null);
			}
		}

		let from = Util.getStringFromLanguageCode(session_model.get('translate_from'));
		let to = Util.getStringFromLanguageCode(session_model.get('translate_to'));

		session_model
		.save()
		.then(() => {
			resolve({
				speech: `Ok, io ti parlo in ${to}, tu mi parli in ${from}`
			});
		});
	});
};