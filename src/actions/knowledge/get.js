exports.id = 'knowledge.get';

const Wolfram = apprequire('wolfram');

module.exports = function({ result }, session) {
	return new Promise(async(resolve) => {
		let { parameters: p, fulfillment } = result;

		resolve({
			speech: fulfillment.speech,
			data: {
				feedback: true
			}
		});

		try {
			const speech = await Wolfram.complexQuery(result.resolvedQuery, session.getTranslateTo());
			IOManager.output({ 
				speech: speech 
			}, session);
		} catch (err) {
			IOManager.output({ 
				data: {
					error: rand(fulfillment.payload.errors.notFound.generic)
				} 
			}, session);
		}
	});
};