exports.id = 'lights.poweron';

const MIIO = apprequire('miio');

module.exports = async function({ queryResult }, session) {
	let { parameters: p, fulfillmentText } = queryResult;
	setTimeout(async () => {
		const device = await MIIO.retrieveDefaultDevice();
		await device.setPower(false);
	}, 0);
	return fulfillmentText;
};
