exports.id = 'knowledge.get';

module.exports = function({ sessionId, result }, session_model) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		Data.Knowledge
		.findOne({ $text: { $search: p.q }}, { score: { $meta: 'textScore' }})
		.sort({ score: { $meta: 'textScore' } })
		.then((knowledge) => {

			/*
			If knowledge doesn't exists, ask the user to add
			*/

			if (knowledge == null) {

				session_model.saveInPipe({
					knowledgeGet: p.q
				});

				resolve({
					speech: fulfillment.speech,
					contextOut: [
					{ name: 'knowledge_add', lifespan: 1 }
					]
				});

			} else {
				resolve({
					speech: knowledge.output
				});
			}

		})
		.catch(reject);

	});
};