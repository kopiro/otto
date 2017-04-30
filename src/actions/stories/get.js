exports.id = 'stories.get';

module.exports = function({ sessionId, result }) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		ORM.Story
		.find()
		.then((stories) => {
			const story = stories[0];
			resolve({
				speech: story.text,
				data: {
					url: story.url
				}
			});
		})
		.catch(reject);
	});
};