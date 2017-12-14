exports.id = 'knowledge.get';

const Wolfram = apprequire('wolfram');

module.exports = function({ result }, session_model) {
	return new Promise(async(resolve) => {
		let { parameters: p, fulfillment } = result;

		resolve({
			speech: fulfillment.speech,
			data: {
				feedback: true
			}
		});

		try {
			const speech = await Wolfram.complexQuery(result.resolvedQuery, session_model.getTranslateTo());
			IOManager.input({
				params: { fulfillment: { speech: speech } },
				session_model: session_model
			});
		} catch (err) {
			IOManager.input({
				params: { fulfillment: { data: {
					error: getRandomElement(fulfillment.payload.notFound.generic)
				} } },
				session_model: session_model
			});
		}
	});
};