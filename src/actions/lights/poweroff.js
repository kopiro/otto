exports.id = 'lights.poweron';

const MIIO = apprequire('miio');

module.exports = function({ sessionId, result }, session_model) {
	return new Promise(async(resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		const device = await MIIO.retrieveDefaultDevice();
		await device.setPower(false);
		resolve({
			speech: 'Fatto!'
		});
	});
};