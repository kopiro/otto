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
			IOManager.output({
				speech: speech
			}, session_model);
		} catch (err) {
			IOManager.output({
				data: {
					error: getRandomElement(fulfillment.payload.errors.generic)
				}
			}, session_model);
		}
	});
};