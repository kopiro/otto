exports.id = 'alarm.good_morning_question';

module.exports = async function({ queryResult }, session) {
	let { parameters: p, fulfillmentMessages, queryText } = queryResult;

	const question = session.pipe.good_morning_question;
	if (question == null) return;

	if (question.answers.indexOf(queryText.toLowerCase()) >= 0) {
		const e = extractWithPattern(fulfillmentMessages, '[].payload.correct');
		// Zerofy contexts
		e.outputContexts = [
			{
				name: 'good_morning_question',
				lifespanCount: 0
			}
		];
		return e;
	}

	const e = extractWithPattern(fulfillmentMessages, '[].payload.wrong');
	e.fulfillmentText = e.fulfillmentText.replace('$_question', question);
	return e;
};
