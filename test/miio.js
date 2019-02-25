require('../boot');
const miio = requireLibrary('miio');
async function main() {
	const devices = miio.devices({
		cacheTime: 300
	});
	devices.on('available', reg => {
		console.log(reg);
		const device = reg.device;
	});
}
main();