exports.capabilities = { 
	user_can_view_urls: true
};


const fs = require('fs');

let strings = fs.readFileSync('in.txt').toString().split("\n");
let callback;
let sessionId = Date.now();

exports.onInput = function(cb) {
	callback = cb;
};

exports.startInput = function() {
	if (strings.length === 0) {
		console.info('IO.Test', 'end');
		return;
	}

	let msg = strings.shift();
	console.user(msg);

	callback({
		sessionId: sessionId,
		text: msg
	});
};

exports.output = function(e) {
	console.ai('AI.Test', 'output', JSON.stringify(e, null, 2));

	if (e.text) {
		return Promise.resolve();
	} else if (e.spotify) {
		return new Promise((resolve, reject) => {
			require('spotify-node-applescript').playTrack(e.spotify.uri, resolve);
		});
	} else {
		return Promise.resolve();
	}
};