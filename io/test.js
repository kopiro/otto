const fs = require('fs');

let strings = fs.readFileSync('in.txt').toString().split("\n");
let callback;

exports.onInput = function(cb) {
	callback = cb;
	
};

exports.startInput = function() {
	if (strings.length === 0) {
		console.info('IO.Test', 'end');
		process.exit();
	}

	let msg = strings.shift();
	console.user(msg);

	callback({
		text: msg
	});
};

exports.output = function(e) {
	console.ai('AI.Test', 'output', e);

	if (e.text) {
		return Promise.resolve();
	} else if (e.spotifyUrl) {
		return new Promise((resolve, reject) => {
			require('spotify-node-applescript').playTrack(e.spotify.uri, resolve);
		});
	}
};