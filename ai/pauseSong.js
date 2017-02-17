module.exports = function pauseSong(request) {
	return new Promise(function(resolve, reject) {
		require('spotify-node-applescript').pause();
		resolve();
	});
};