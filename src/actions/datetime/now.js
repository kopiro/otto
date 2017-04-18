exports.id = 'datetime.now';

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		
		const now = require('moment')().format('LT');

		resolve({
			speech: `Sono le ${now}`
		});
	});
};