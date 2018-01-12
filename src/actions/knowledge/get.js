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
			IOManager.input({
				fulfillment: { speech: speech },
				session: session
			});
		} catch (err) {
			IOManager.input({
				fulfillment: { 
					data: {
						error: rand(fulfillment.payload.errors.notFound.generic)
					} 
				},
				session: session
			});
		}
	});
};