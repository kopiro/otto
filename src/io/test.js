const TAG = 'IO.Test';

const EventEmitter = require('events').EventEmitter;
exports.emitter = new EventEmitter();

exports.id = 'test';
exports.capabilities = { 
	userCanViewUrls: true
};

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let strings = fs.readFileSync(__basedir + '/in.txt').toString().split("\n");
const sessionId = config.io.test.sessionId || require('node-uuid').v4();

exports.startInput = function() {
	console.info(TAG, 'start');

	IOManager.registerSession(sessionId, exports.id, process.platform)
	.then((session_model) => {
		let msg = strings.shift();

		if (_.isEmpty(msg)) {
			rl.question('> ', (answer) => {
				console.info(TAG, 'input', answer);
				exports.emitter.emit('input', {
					session_model: session_model,
					params: {
						text: answer
					}
				});
			});
		} else {
			console.info(TAG, 'input', msg);
			exports.emitter.emit('input', {
				session_model: session_model,
				params: {
					text: msg
				}
			});
		}
	})
	.catch((session_model) => {
		exports.emitter.emit('input', {
			session_model: session_model,
			error: {
				unauthorized: true
			}
		});
	});
};

exports.output = function(f, session_model) {
	if (null == config.testDriver) {
		console.info(TAG, 'output', session_model.id, f);
		return Promise.resolve();
	}

	return IOManager.getDriver(config.testDriver, true).output(f, session_model);
};