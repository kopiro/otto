exports.id = 'stories.get';

/*
db.stories.createIndex({"title":"text","tag":"text"})
*/

module.exports = function({ sessionId, result }, session_model) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		Data.Story
		.findOne({ $text: { $search: p.q }}, { score: { $meta: "textScore" }})
		.sort({ score: { $meta:"textScore" } })
		.then((story) => {
			if (story == null) {
				resolve({
					speech: 'Mi dispiace, ma non ricordo nulla del genere... 😔'
				});
			} else {
				resolve({
					speech: story.text,
					data: {
						url: story.url
					}
				});
			}
		})
		.catch(reject);

	});
};