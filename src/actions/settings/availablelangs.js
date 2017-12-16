exports.id = 'settings.availablelangs';

const _ = require('underscore');
const Translator = apprequire('translator');

module.exports = function({ sessionId, result }, session) {
	return new Promise(async(resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		let languages = await Translator.getLanguages(config.language);
		languages = _.pluck(avail_langs, 'name').join(', ');

		resolve({
			speech: `Io parlo ${languages}`
		});
	});
};