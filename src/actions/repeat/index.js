exports.id = 'repeat';

const _ = require('underscore');

module.exports = function({ sessionId, result }, session) {
	return new Promise(async(resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		if (_.isEmpty(p.driver)) {
			return resolve({
				speech: p.q
			});
		}

		let session_by_driver = await session.getRelatedSessions()
		.findOne({ io_id: p.driver });
		if (session_by_driver == null) {
			return reject();
		}

		IOManager.input({
			params: { fulfillment: {
				speech: p.q
			} },
			session: session_by_driver
		});
		
		return resolve({});
	});
};