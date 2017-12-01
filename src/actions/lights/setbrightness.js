exports.id = 'lights.setbrightness';

const MIIO = apprequire('miio');

module.exports = function({ sessionId, result }, session_model) {
	return new Promise(async(resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		resolve({
			speech: 'Ok, dammi un attimo...'
		});
		const device = await MIIO.retrieveDefaultDevice();
		await device.setBrightness(parseInt(p.value, 10));
	});
};