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

exports.output = function({text}) {
	return new Promise((resolve, reject) => {
		console.ai(text);
		resolve();
	});
};