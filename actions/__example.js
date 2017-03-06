const TAG = __filename;

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);
		let { parameters:p, fulfillment, resolvedQuery } = e;

		// You have to resolve your promise always.
		// Only with unhandled inputs you must reject.
		
	});
};