exports.id = 'camera.spy';

const Camera = apprequire('camera');

module.exports = function({ sessionId, result }, session_model) {
	return new Promise(async(resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		resolve({
			speech: fulfillment.speech,
			data: {
				feedback: true
			}
		});

		const video_file = await Camera.recordVideo({
			time: 3
		});
		IOManager.output({
			data: {
				video: {
					localFile: video_file
				}
			}
		}, session_model);	
	});
};