exports.id = 'lights.setcolor';

const colorConvert = require('color-convert');
const MIIO = apprequire('miio');

module.exports = function({ sessionId, result }, session_model) {
	return new Promise(async(resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		resolve({
			speech: fulfillment.speech
		});

		const device = await MIIO.retrieveDefaultDevice();
		let hex = colorConvert.keyword.hex(p.color);
		if (!device.power) await device.setPower(true);
		await device.setRGB(hex);
	});
};