exports.id = 'settings.chromecast.set';

module.exports = async function({ queryResult }, session) {
	let { parameters: p, fulfillmentText } = queryResult;
	await session.saveServerSettings({
		chromecast: p.chromecast
	});
	return fulfillmentText;
};
