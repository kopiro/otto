exports.id = 'settings.chromecast.set';

const _ = require('underscore');

module.exports = async function({ sessionId, result }, session) {
	let { parameters: p, fulfillment } = result;
	await session.setSettings({
		chromecast: p.chromecast
	});
    return fulfillment;
};