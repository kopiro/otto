exports.id = 'settings.availablelangs';

module.exports = function({ sessionId, result }, session_model) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		apprequire('translator').getLanguages(config.language, (err, avail_langs) => {
			if (err) return reject();

			const languages = _.pluck(avail_langs, 'name').join(', ');

			resolve({
				speech: `Io parlo ${languages}`
			});
		});
	});
};