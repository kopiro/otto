const TAG = 'IO.Test';

exports.capabilities = { 
	userCanViewUrls: true
};

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let strings = fs.readFileSync(__basedir + '/in.txt').toString().split("\n");
let callback;

exports.onInput = function(cb) {
	callback = cb;
};

exports.startInput = function() {
	console.info(TAG, 'start');

	let data = { time: Date.now() };

	let msg = strings.shift();

	if (_.isEmpty(msg)) {
		console.info(TAG, 'starting TTY');
		rl.question('> ', (answer) => {
			console.user(TAG, answer);
			callback(null, data, {
				text: answer
			});
		});
	} else {
		console.user(TAG, msg);
		callback(null, data, {
			text: msg
		});
	}
};

exports.output = function(data, e) {
	console.ai(TAG, e);
	return Promise.resolve();
	return require(__basedir + '/io/kid').output(data, e);
};