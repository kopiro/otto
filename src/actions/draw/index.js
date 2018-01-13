exports.id = 'draw';

const ImageSearch = apprequire('imagesearch');

module.exports = async function({ sessionId, result }) {
	let { parameters: p, fulfillment } = result;

	const images = await ImageSearch.search(`disegno "${p.q}"`)
	let img = rand(images);

	return {
		data: {
			image: {
				uri: img.url
			}
		}
	};
};