exports.id = 'messaging.sendto';

const SessionSearch = helperrequire('sessionsearch');

module.exports = async function(body, session) {
	const { sessionId, result } = body;
	const { parameters: p, fulfillment } = result;

	const user = await SessionSearch(body, session, p.to);

	await IOManager.output({
		speech: `Hey! ${session.alias} mi ha detto di riferirti questo: ${p.text}`
	}, user);

	return fulfillment.speech;
};