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
				params: { fulfillment: { speech: speech } },
				session: session
			});
		} catch (err) {
			IOManager.input({
				params: { fulfillment: { data: {
					error: getRandomElement(fulfillment.payload.notFound.generic)
				} } },
				session: session
			});
		}
	});
};