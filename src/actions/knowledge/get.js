exports.id = 'knowledge.get';

const Wolfram = apprequire('wolfram');

module.exports = function({ result }, session_model) {
	return new Promise(async(resolve) => {
		resolve({
			speech: result.fulfillment.speech
		});

		const speech = await Wolfram.complexQuery(result.resolvedQuery, session_model.getTranslateTo());
		IOManager.output({
			speech: speech
		}, session_model);
	});
};