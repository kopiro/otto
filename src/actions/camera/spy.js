exports.id = 'camera.spy';

module.exports = function({ sessionId, result }, session_model) {
	return new Promise((resolve, reject) => {
		let { parameters: p, fulfillment } = result;

		resolve({
			speech: "Ok, dammi un attimo e ti faccio vedere..."
		});

		apprequire('camera').recordVideo({
			time: 3
		})
		.then((video_file) => {

			IOManager.output({
				data: {
					video: {
						localFile: video_file
					}
				}
			}, session_model);

		})
		.catch(reject);		
	});
};