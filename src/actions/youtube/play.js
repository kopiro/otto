exports.id = 'youtube.play';

const Youtube = apprequire('youtube');

module.exports = function ({
	sessionId,
	result
}, session) {
	return new Promise(async (resolve, reject) => {
		const {
			parameters: p,
			fulfillment
		} = result;

		resolve({
			speech: fulfillment.speech,
			data: {
				feedback: true
			}
		});

		const videos = await Youtube.searchVideos(p.q, 1);
		console.log('videos :', videos[0]);
		IOManager.output({
				data: {
					video: {
						youtube: videos[0]
					}
				}
			},
			session);
	});
};