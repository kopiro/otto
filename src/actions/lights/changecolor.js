exports.id = 'lights.poweron';

const colorConvert = require('color-convert');
const colorTemp = require('color-temperature');

const MIIO = apprequire('miio');

module.exports = function({ sessionId, result }, session_model) {
	return new Promise(async(resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		const device = await MIIO.retrieveDefaultDevice();
		
		let rgb = colorConevrt.keyword.rgb(p.color);
		let kelvin = colorTemp.rgb2colorTemperature({
			red: rgb[0],
			green: rgb[1],
			blue: rgb[2]
		});

		await device.setPower(true);
		await device.setColorTemperature(kelvin);

		resolve({
			speech: 'Fatto!'
		});
	});
};