exports.id = 'repeat.index';

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		return resolve({
			speech: p.q
		});
	});
};