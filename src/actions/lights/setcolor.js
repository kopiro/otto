exports.id = 'lights.setcolor';

const colorConvert = require('color-convert');

const MIIO = apprequire('miio');

module.exports = function({ sessionId, result }, session_model) {
	return new Promise(async(resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		const device = await MIIO.retrieveDefaultDevice();
		resolve({
			speech: 'Ok, dammi un attimo...'
		});

		let hex = colorConvert.keyword.hex(p.color);
		if (!device.power) await device.setPower(true);
		await device.setRGB(hex);
	});
};