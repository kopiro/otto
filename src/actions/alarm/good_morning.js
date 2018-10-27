exports.id = 'alarm.good_morning';

const Moment = apprequire('moment');

function handleMathProduct(question) {
	const a = 1 + Math.floor(Math.random() * 9);
	const b = 1 + Math.floor(Math.random() * 9);
	question.answers = [String(a * b)];
	question.text = question.text.replace('$_a', a).replace('$_b', b);
	return question;
}

function handleMathSum(question) {
	const a = 1 + Math.floor(Math.random() * 100);
	const b = 1 + Math.floor(Math.random() * 100);
	question.answers = [String(a + b)];
	question.text = question.text.replace('$_a', a).replace('$_b', b);
	return question;
}

module.exports = async function ({
	sessionId,
	result
}, session) {
	let {
		parameters: p,
		fulfillment
	} = result;

	if (fulfillment.speech) {
		await IOManager.output({
			speech: fulfillment.speech
		}, session);
	}

	if (fulfillment.payload.questions) {
		let question = rand(fulfillment.payload.questions);
		switch (question.kind) {
			case 'math.product':
				question = handleMathProduct(question);
				break;
			case 'math.sum':
				question = handleMathSum(question);
				break;
		}

		await session.savePipe({
			good_morning_question: question
		});

		await IOManager.output({
			speech: question.text
		});
	}

	return false;
};