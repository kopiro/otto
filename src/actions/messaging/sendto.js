exports.id = 'messaging.sendto';

const SessionSearch = requireHelper('sessionsearch');

module.exports = async function(body, session) {
	const { parameters: p, fulfillmentText } = body.queryResult;

	const user = await SessionSearch(body, session, p.to);

	await IOManager.output(
		{
			fulfillmentText: fulfillmentText
				.replace('$_user', session.alias)
				.replace('$_text', p.text)
		},
		user
	);

	return fulfillmentText;
};
