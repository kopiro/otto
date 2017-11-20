exports.id = 'repeat';

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		// return resolve({
		// 	speech: p.q
		// });
		IOManager.output({
			speech: p.q
		}, { io_id: 'test', _id: 'test/Elerium.local' });
	});
};