exports.id = 'knowledge.add';

module.exports = function({ sessionId, result }, session_model) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		var knowledgeGet = session_model.getPipe().knowledgeGet;
		if (knowledgeGet == null) return reject();

		new Data.Knowledge({
			input: knowledgeGet,
			output: result.resolvedQuery,
			session: session_model._id
		})
		.save()
		.then((knowledge) => {
			resolve({
				speech: result.fulfillment.speech
			});
		})
		.catch(reject);

	});
};