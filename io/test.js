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
	return new Promise((resolve, reject) => {
		console.ai(TAG, e);
		if (_.isString(e)) e = { text: e };

		if (e.error) return resolve();

		if (e.text) {
			return require('child_process').spawn(__basedir + '/out-speech.sh', [ e.text ])
			.addListener('exit', (err) => {
				if (err) return reject(err);
				resolve();
			});
			return require(__basedir + '/support/tts').play(e.text)
			.then(resolve)
			.catch(reject);
		}

		if (e.spotify) {
			return require(__basedir + '/io/speech')
			.output(e)
			.then(resolve)
			.catch(reject);
		}

		if (e.photo) {
			return resolve();
		}

		return reject();
	});
};