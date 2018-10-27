exports.id = 'alarm.good_morning_question';

const Moment = apprequire('moment');

module.exports = async function ({
	sessionId,
	result
}, session) {
	let {
		parameters: p,
		fulfillment
	} = result;

	const question = session.pipe.good_morning_question;
	if (question == null) return;

	if (question.answers.indexOf(result.resolvedQuery.toLowerCase()) >= 0) {
		return {
			contextOut: [{
				name: 'good_morning_question',
				lifespan: 0
			}],
			data: fulfillment.payload.correct
		};
	}

	fulfillment.payload.wrong.speech = fulfillment.payload.wrong.speech.replace('$_question', question.text);

	return {
		contextOut: [{
			name: 'good_morning_question',
			lifespan: 2
		}],
		data: fulfillment.payload.wrong
	};
};