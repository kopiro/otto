exports.id = 'datetime.now';

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(exports.id, e);
		let { parameters, fulfillment } = e;
		const now = require('moment')().format('LT');

		resolve({
			text: `Sono le ${now}`
		});
	});
};