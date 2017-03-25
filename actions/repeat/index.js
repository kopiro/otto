exports.id = 'repeat.index';

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(exports.id, e);
		let { parameters:p, fulfillment, resolvedQuery } = e;

		return resolve({
			text: p.q
		});
	});
};