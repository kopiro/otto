const TAG = path.basename(__filename);

module.exports = function(e, io) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);
		let { parameters, fulfillment, resolvedQuery } = e;

		Memory.Memory.byText(resolvedQuery)
		.then((memory) => {
			let text = (fulfillment.speech || "") + " ";
			if (memory.text) text += memory.text + " ";
			if (io.capabilities.userCanViewUrls && memory.url) text += memory.url +  " ";
			resolve(text);
		})
		.catch((err) => {
			err.text = 'Non ho ricordi di questa cosa';
			reject(err);
		});
	});
};