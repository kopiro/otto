exports.id = 'draw';

const ImageSearch = requireLibrary('imagesearch');

module.exports = async function({ queryResult }, session) {
	let { parameters: p, fulfillmentText, queryText } = queryResult;

	const images = await ImageSearch.search(`"${p.q}"`);
	const img = rand(images);

	return {
		payload: {
			image: {
				uri: img.url
			}
		}
	};
};
