exports.id = 'stories.get';

module.exports = async function({ sessionId, result }, session_model) {
	let { parameters: p, fulfillment } = result;

	const story = await Data.Story
	.findOne({ $text: { $search: p.q }}, { score: { $meta: "textScore" }})
	.sort({ score: { $meta:"textScore" } });

	if (story == null) {
		throw fulfillment.payload.errors.notFound;
	}

	return {
		speech: story.text,
		data: {
			url: story.url
		}
	};
};