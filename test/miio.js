require('../boot');
const MIIO = apprequire('miio');
async function main() {
	const device = await MIIO.retrieveDefaultDevice();
	await device.setPower(true);
	await device.setBrightness(10);
	await device.setColorTemperature(6500);
}
main();