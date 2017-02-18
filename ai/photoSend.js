module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.info('AI.photoSend', e);
		let {parameters} = e;

		let query;

		if (parameters.photo_tag) {
			query = parameters.photo_tag;
		} else if (parameters['geo-city']) {
			query = parameters['geo-city'];
		}

		Memory.getPhotoByTag(query)
		.then((photo) => {
			resolve({
				text: `Ecco una mia bella foto ${photo.url}`
			});
		})
		.catch((err) => {
			reject({
				text: 'Non ho ricordi di questa cosa'
			});
		});
	});
};