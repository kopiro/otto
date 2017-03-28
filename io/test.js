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

function registerSession(sessionId, data) {
	return new Promise((resolve, reject) => {
		new Memory.Session({ id: sessionId })
		.fetch({ require: true })
		.then((session_model) => {
			if (!session_model.get('approved')) return reject(session_model);
			resolve(session_model);
		})
		.catch((err) => {
			let session_model = new Memory.Session({ 
				id: sessionId,
				io_id: exports.id,
				io_data: JSON.stringify(data)
			}).save(null, { method: 'insert' });
			reject(session_model);
		});
	});
}

exports.getChats = function() {
	return Promise.resolve([]);
};

exports.getAlarmsAt = function() {
	return Promise.resolve([]);
};

exports.startInput = function() {
	console.info(TAG, 'start');

	registerSession(sessionId, process.platform)
	.then((session_model) => {
		let msg = strings.shift();

		if (_.isEmpty(msg)) {
			rl.question('> ', (answer) => {
				console.user(TAG, 'input', answer);
				exports.emitter.emit('input', {
					session_model: session_model,
					params: {
						text: answer
					}
				});
			});
		} else {
			console.user(TAG, 'input', msg);
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
	if (null == config.testDriverOut) {
		console.ai(TAG, 'output', session_model.id, JSON.stringify(f, null, 2));
		return Promise.resolve();
	}

	return require(__basedir + '/io/' + config.testDriverOut).output(f, session_model);
};