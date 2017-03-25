exports.id = 'draw.index';

const _config = config.ai.gcloud;

const ImagesClient = require('google-images');
const client = new ImagesClient(_config.cseId, _config.apiKey);

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		console.debug(exports.id, e);
		let { parameters, fulfillment } = e;

		client.search(`disegno "${parameters.q}"`)
		.then((images) => {
			let img = images.getRandom();
			console.debug(exports.id, 'result', img);
			resolve({
				photo: {
					remoteFile: img.url
				}
			});
		})
		.catch((err) => {
			reject(err);
		});
	});
};