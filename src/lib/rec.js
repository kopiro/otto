const TAG = 'Rec';

const _ = require('underscore');
const spawn = require('child_process').spawn;

let proc = null;

// returns a Readable stream
exports.start = function(opt = {}) {
	if (proc) proc.kill();

	_.defaults(opt, {
		sampleRate: 16000,
		threshold: '3',
		stopOnSilence: false,
		verbose: false,
		time: false
	});

	let args = [
	'-q',
	'-r', opt.sampleRate,
	'-c', '1',
	'-e', 'signed-integer',
	'-b', '16',
	'-t', 'wav',
	'-',
	];

	if (opt.stopOnSilence) {
		// silence 1 0.1 3% 1 3.0 3%
		args = args.concat('silence', '1', '0.1', opt.threshold + '%', '1', '3.0', opt.threshold + '%');
	}

	if (opt.time) {
		args = args.concat('trim', '0', opt.time);
	}

	console.debug(TAG, 'Recording...');
	proc = spawn('rec', args, {
		encoding: 'binary'
	});

	proc.stdout.on('end', function () {
		console.debug(TAG, 'end');
	});

	return proc.stdout;
};

exports.getStream = function() {
	if (null == proc) return;
	return proc.stdout;
};

exports.stop = function () {
	if (null == proc) return;
	
	console.log(TAG, 'stop');
	proc.kill();
};