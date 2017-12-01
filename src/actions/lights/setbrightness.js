exports.id = 'lights.setbrightness';

const MIIO = apprequire('miio');

module.exports = function({ sessionId, result }, session_model) {
	return new Promise(async(resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		resolve({
			speech: fulfillment.fulfillment
		});
		const device = await MIIO.retrieveDefaultDevice();
		if (!device.power) await device.setPower(true);
		await device.setBrightness(parseInt(p.value, 10));
	});
};