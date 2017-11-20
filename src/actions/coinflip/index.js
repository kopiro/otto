exports.id = 'coinflip';

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		
		resolve({
			speech: [ 'Testa', 'Croce' ].getRandom()
		});
	});
};