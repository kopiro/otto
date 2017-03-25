exports.id = 'media.navigation.next';

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(exports.id, e);
		let { parameters:p, fulfillment, resolvedQuery } = e;
		resolve({
			media: {
				action: 'next'
			}
		});
	});
};