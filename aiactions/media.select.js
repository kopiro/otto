const _config = config.ai.spotify;
const TAG = path.basename(__filename, '.js');

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		let {parameters} = e;
		resolve({
			spotify: {
				action: parameters.action === 'on' ? 'play' : 'pause'
			}
		});
	});
};