exports.id = 'cirfood.tellorder';

const SessionSearch = helperrequire('sessionsearch');

module.exports = async function(body, session) {
	const { sessionId, result } = body;
	const { parameters: p, fulfillment } = result;

	const user = await SessionSearch(body, session, p.who);
	const order = user.settings.cirfood_bookings[p.date];


	if (order == null) {
		return {
			speech: fulfillment.payload.speechs.fail.replace('$_who', user.alias)
		};
	}

	let speech = fulfillment.payload.speechs.success
	.replace('$_who', user.alias)
	.replace('$_order', order.map(e => e.text).join(', '));

	return {
		speech: speech
	};
};