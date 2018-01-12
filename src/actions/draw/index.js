exports.id = 'draw';

const ImagesClient = require('google-images');
const client = new ImagesClient(config.gcloud.cseId, config.gcloud.apiKey);

module.exports = async function({ sessionId, result }) {
	let { parameters: p, fulfillment } = result;

	const images = await client.search(`disegno "${p.q}"`)
	let img = rand(images);
	console.log(img);
	return {
		data: {
			image: {
				uri: img.url
			}
		}
	};
};