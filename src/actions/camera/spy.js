exports.id = 'camera.spy';

const Camera = apprequire('camera');

module.exports = function({ sessionId, result }, session) {
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
		IOManager.input({
			fulfillment: {
				data: {
					video: {
						localFile: video_file
					}
				}
			},
			session: session
		});
	});
};