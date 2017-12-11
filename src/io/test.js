const TAG = 'IO.Test';
exports.id = 'test';

const _ = require('underscore');
const fs = require('fs');
const readline = require('readline');

const emitter = exports.emitter = new (require('events').EventEmitter)();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let initial_strings = fs.readFileSync(__etcdir + '/io_test.txt').toString().split("\n");

async function registerGlobalSession() {
	return IOManager.registerSession({
		sessionId: require('os').hostname(),
		uid: config.uid || uuid(),
		io_id: exports.id, 
		io_data: { platform: process.platform }
	}, true);
}

exports.startInput = async function() {
	if (IOManager.sessionModel == null) {
		await registerGlobalSession();
	}

	let msg = initial_strings.shift();

	if (!_.isEmpty(msg)) {
		console.info(TAG, 'input', msg);
		return emitter.emit('input', {
			session_model: IOManager.sessionModel,
			params: {
				text: msg
			}
		});
	}
	
	rl.question('> ', (answer) => {
		if (/^EVAL /.test(answer)) {
			answer = answer.replace(/^EVAL /, '');
			console.debug(answer);
			try {
				eval(answer);
			} catch (err) {
				console.error(err);
			}
			exports.startInput();
		} else {
			emitter.emit('input', {
				session_model: IOManager.sessionModel,
				params: {
					text: answer
				}
			});
		}
	});

	exports.startInput();
};

exports.output = async function(f) {
	const session_model = IOManager.sessionModel;

	console.info(TAG, 'output');
	emitter.emit('output', {
		sessionModel: session_model,
		fulfillment: f
	});

	for (let i = 0; i < 50; i++) process.stdout.write("="); process.stdout.write("\n");
	console.dir(f);
	for (let i = 0; i < 50; i++) process.stdout.write("="); process.stdout.write("\n");
};