require('../boot');
const Camera = apprequire('camera');
async function main() {
	const video_file = await Camera.recordVideo({
		time: 3
	});
	console.log(video_file);
}
main();