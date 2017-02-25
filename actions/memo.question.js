const TAG = path.basename(__filename);

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);
		let { parameters, fulfillment, resolvedQuery } = e;

		Memory.byText(resolvedQuery)
		.then((memory) => {
			let text = (fulfillment.speech || "") + " ";
			if (memory.text) text += memory.text + " ";
			if (IO.capabilities.userCanViewUrls && memory.url) text += memory.url +  " ";
			resolve(text);
		})
		.catch((err) => {
			err.text = 'Non ho ricordi di questa cosa';
			reject(err);
		});
	});
};