exports.id = 'datetime.now';

const Moment = apprequire('moment');

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		
		const now = Moment.format('LT');

		resolve({
			speech: `Sono le ${now}`
		});
	});
};