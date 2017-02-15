const fs = require('fs');

let strings = require('fs').readFileSync('../in.txt').toString().split("\n");

exports.onInput = function(callback) {
	if (strings.length == 0) {
		process.exit();
	}

	let msg = strings.shift();
	console.user(msg);

	callback({
		text: msg
	});
};

exports.output = function({text}) {
	return new Promise((resolve, reject) => {
		console.ai(text);
		resolve();
	});
};