exports.id = 'media.karaoke.play';

module.exports = function({ sessionId, result }) {
	return new Promise(async(resolve, reject) => {
		let { parameters: p, fulfillment } = result;
		
		const musics = await Data.Music.find();
		const music = musics.getRandom();
		resolve({
			data: {
				voice: {
					remoteFile: music.url
				}
			}
		});
	});
};