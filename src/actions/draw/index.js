exports.id = 'draw';

const ImagesClient = require('google-images');
const client = new ImagesClient(config.gcloud.cseId, config.gcloud.apiKey);

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		client.search(`disegno "${p.q}"`)
		.then((images) => {
			let img = getRandomElement(images);
			resolve({
				data: {
					image: {
						uri: img.url
					}
				}
			});
		})
		.catch(reject);
	});
};