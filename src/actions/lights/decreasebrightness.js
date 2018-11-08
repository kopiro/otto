exports.id = 'lights.poweron';

const MIIO = apprequire('miio');

module.exports = async function({ queryResult }, session) {
	let { parameters: p, fulfillmentText } = queryResult;
	setTimeout(async () => {
		const device = await MIIO.retrieveDefaultDevice();
		if (!device.power) await device.setPower(true);
		await device.setBrightness(Math.max(0, device.brightness - 30));
	}, 0);
	return fulfillmentText;
};
