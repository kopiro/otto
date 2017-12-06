const TAG = 'Rec';

const _ = require('underscore');

const spawn = require('child_process').spawn;
let rec;

// returns a Readable stream
exports.start = function(opt) {
	if (rec) rec.kill();

	opt = _.defaults(opt || {}, config.rec, {
		sampleRate: 16000,
		threshold: '3',
		stopOnSilence: false,
		verbose: false,
		time: false
	});

	let rec_opt = {
		encoding: 'binary'
	};

	let rec_args = [
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
		rec_args = rec_args.concat('silence', '1', '0.1', opt.threshold + '%', '1', '3.0', opt.threshold + '%');
	}

	if (opt.time) {
		rec_args = rec_args.concat('trim', '0', opt.time);
	}

	if (opt.device) {
		rec_opt.env = Object.assign({}, process.env, { AUDIODEV: opt.device });
	}

	console.debug(TAG, 'recording...');
	rec = spawn('rec', rec_args, rec_opt);

	rec.stdout.on('end', function () {
		console.debug(TAG, 'end');
	});

	return rec.stdout;
};

exports.getStream = function() {
	return rec.stdout;
};

exports.stop = function () {
	if (null == rec) return;
	
	console.log(TAG, 'stop');
	rec.kill();
};