exports.id = 'repeat';

module.exports = function({ sessionId, result }, session) {
	return new Promise(async(resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		return resolve({
			speech: p.q
		});
	});
};