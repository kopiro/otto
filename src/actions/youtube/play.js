exports.id = 'youtube.play';

const Youtube = apprequire('youtube');

module.exports = function({ sessionId, result }, session) {
	return new Promise(async(resolve, reject) => {
		const { parameters: p, fulfillment } = result;

		resolve({
			speech: fulfillment.speech,
			data: {
				feedback: true
			}
		});

		const videos = await Youtube.searchVideos(p.q, 1);
		IOManager.input({
			fulfillment: {
				data: {
					video: {
						youtube: {
							id: videos[0].id
						}
					}
				}
			},
			session: session
		});
	});
};