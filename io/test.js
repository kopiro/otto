const TAG = 'IO.Test';

const EventEmitter = require('events').EventEmitter;
exports.emitter = new EventEmitter();

exports.id = path.basename(__filename, '.js');
exports.capabilities = { 
	userCanViewUrls: true
};

exports.pendingActions = {};

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let strings = fs.readFileSync(__basedir + '/in.txt').toString().split("\n");
const sessionId = require('node-uuid').v4();

exports.getChats = function() {
	return Promise.resolve([]);
};

exports.getAlarmsAt = function() {
	return Promise.resolve([]);
};

exports.startInput = function() {
	console.info(TAG, 'start');
	let data = { 
		sessionId: sessionId
	};
	let msg = strings.shift();

	if (_.isEmpty(msg)) {
		rl.question('> ', (answer) => {
			console.user(TAG, 'input', answer);
			exports.emitter.emit('input', {
				data: data,
				params: {
					text: answer
				}
			});
		});
	} else {
		console.user(TAG, 'input', msg);
		exports.emitter.emit('input', {
			data: data,
			params: {
				text: msg
			}
		});
	}
};

exports.output = function({ data, fulfillment:f }) {
	if (null == config.testDriverOut) {
		console.ai(TAG, 'output', JSON.stringify(f, null, 2));
		return Promise.resolve();
	}

	return require(__basedir + '/io/' + config.testDriverOut).output({
		data: data,
		fulfillment: f
	});
};