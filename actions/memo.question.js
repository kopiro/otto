const TAG = path.basename(__filename);

module.exports = function(e, io) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);
		let { parameters, fulfillment, resolvedQuery } = e;

		Memory.Memory.byText(resolvedQuery)
		.then((memory) => {
			let text = (fulfillment.speech || "") + " ";
			if (memory.get('text')) text += memory.get('text') + " ";
			if (io.capabilities.userCanViewUrls && memory.get('url')) {
				text += memory.get('url') +  " ";
			}
			resolve(text);
		})
		.catch((err) => {
			reject('Non ho ricordi di questa cosa');
		});
	});
};