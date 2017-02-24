const TAG = 'IO.Test';

exports.capabilities = { 
	user_can_view_urls: true
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
	if (strings.length === 0) {
		console.info('IO.Test', 'starting TTY');
		rl.question('> ', (answer) => {
			callback({
				data: { test: Date.now() },
				text: answer
			});
		});
		return;
	}

	let msg = strings.shift();
	console.user(msg);

	callback({
		data: { test: Date.now() },
		text: msg
	});
};

exports.output = function(e) {
	console.ai(TAG, 'output', e);

	if (e.text) {
		return Promise.resolve();
	}

	if (e.spotify) {
		return require(__basedir + '/io/speech').output(e);
	}

	if (e.photo) {
		return Promise.resolve();
	}

	return Promise.reject();
};