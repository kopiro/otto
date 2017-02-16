var spotifyAppleScript = require('spotify-node-applescript');

module.exports = function pauseSong(request) {
	return new Promise(function(resolve, reject) {
		spotifyAppleScript.pause();
		resolve();
	});
};