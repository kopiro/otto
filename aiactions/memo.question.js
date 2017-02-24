const TAG = path.basename(__filename);

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, e);
		let { parameters, fulfillment, resolvedQuery } = e;

		Memory.getMemoryByText(resolvedQuery).then((memory) => {
			let text = (fulfillment.speech || "") + " ";
			if (memory.text) text += memory.text + " ";
			if (IO.capabilities.user_can_view_urls && memory.url) text += memory.url +  " ";

			resolve({
				text: text
			});
		})
		.catch((err) => {
			reject({
				err: err,
				text: 'Non ho ricordi di questa cosa'
			});
		});
	});
};