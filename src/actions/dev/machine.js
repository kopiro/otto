exports.id = 'dev.machine';

module.exports = function ({
	sessionId,
	result
}) {
	return new Promise((resolve, reject) => {
		let {
			parameters: p,
			fulfillment
		} = result;
		resolve({
			speech: `Sto girando su ${process.platform}`
		});
	});
};