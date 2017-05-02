exports.id = 'draw';

const ImagesClient = require('google-images');
const client = new ImagesClient(config.ai.gcloud.cseId, config.ai.gcloud.apiKey);

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		client.search(`disegno "${p.q}"`)
		.then((images) => {
			let img = images.getRandom();
			resolve({
				data: {
					image: {
						remoteFile: img.url
					}
				}
			});
		})
		.catch(reject);
	});
};