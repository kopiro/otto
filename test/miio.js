require('../boot');
const MIIO = apprequire('miio');
async function main() {
	const device = await MIIO.retrieveDefaultDevice();
	await device.setPower(true);
	await device.setBrightness(100);
	await device.setColorTemperature(3000);
}
main();