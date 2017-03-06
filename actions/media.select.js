const _config = config.ai.spotify;
const TAG = path.basename(__filename, '.js');

const actions = {
	on: 'play',
	off: 'pause',
	next: 'next',
	prev: 'prev'
};

module.exports = function(e) {
	return new Promise((resolve, reject) => {
		let { parameters:p } = e;
		resolve({
			spotify: {
				action: actions[p.action]
			}
		});
	});
};