exports.id = 'settings.availablelangs';

const _ = require('underscore');
const Translator = apprequire('translator');

module.exports = function({ sessionId, result }, session_model) {
	return new Promise(async(resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		const languages = await Translator.getLanguages(config.language);
		const languages = _.pluck(avail_langs, 'name').join(', ');

		resolve({
			speech: `Io parlo ${languages}`
		});
	});
};