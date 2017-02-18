module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug('AI.photoSend', JSON.stringify(e, null, 2));
		let { parameters, fulfillment } = e;

		let query;

		if (parameters.photo_tag) {
			query = parameters.photo_tag;
		} else if (parameters['geo-city']) {
			query = parameters['geo-city'];
		}

		Memory.getPhotoByTag(query)
		.then((photo) => {
			resolve({
				text: fulfillment.speech.replace('$url', photo.url)
			});
		})
		.catch((error) => {
			reject({
				error: error,
				text: 'Non ho ricordi di questa cosa'
			});
		});
	});
};