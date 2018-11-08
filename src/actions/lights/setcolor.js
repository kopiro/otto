exports.id = 'lights.setcolor';

const colorConvert = require('color-convert');
const MIIO = apprequire('miio');

module.exports = async function({ queryResult }, session) {
	let { parameters: p, fulfillmentText } = queryResult;
	setTimeout(async () => {
		const device = await MIIO.retrieveDefaultDevice();
		let hex = colorConvert.keyword.hex(p.color);
		if (!device.power) await device.setPower(true);
		await device.setRGB(hex);
	}, 0);
	return fulfillmentText;
};
