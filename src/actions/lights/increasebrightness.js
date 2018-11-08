exports.id = 'lights.poweron';

const MIIO = apprequire('miio');

module.exports = async function({ queryResult }, session) {
	let { parameters: p, fulfillmentText } = queryResult;
	setTimeout(async () => {
		const device = await MIIO.retrieveDefaultDevice();
		if (!device.power) await device.setPower(true);
		await device.setBrightness(Math.min(100, device.brightness + 30));
	}, 0);
	return fulfillmentText;
};
