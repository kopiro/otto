module.exports = function getPhoto(request) {
	return new Promise((resolve, reject) => {
		console.info('AI.photoSend', request);
		let {tag = [{value:null}], location=[{value:null}]} = request.entities;
		let query = null;
		query = tag[0].value || location[0].value;

		Memory.getPhotoByTag(query)
		.then((photo) => {
			resolve({
				url: photo
			});
		})
		.catch((err) => {
			reject({
				text: 'Non ho ricordi di ' + tag
			});
		});
	});
};