exports.id = 'repeat';

const _ = require('underscore');

module.exports = function({ sessionId, result }, session_model) {
	return new Promise(async(resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		if (_.isEmpty(p.driver)) {
			return resolve({
				speech: p.q
			});
		}

		let session_model_by_driver = await session_model.getRelatedSessions().findOne({ io_id: p.driver });
		if (session_model_by_driver == null) {
			return reject();
		}

		IOManager.output({
			speech: p.q,
		}, session_model_by_driver);
		return resolve({});
	});
};