const TAG = 'Rec';

const spawn = require('child_process').spawn;
let rec;

// returns a Readable stream
exports.start = function(opt) {
	_.defaults(opt, {
		sampleRate: 16000,
		threshold: 0.5,
		silence: false,
		device: null,
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

	if (opt.silence) {
		rec_args = rec_args.concat('silence', '1', '0.1', opt.threshold + '%', '1', '1.0', opt.threshold + '%');
	}

	if (opt.time) {
		rec_args = rec_args.concat('trim', '0', opt.time);
	}

	if (opt.device) {
		rec_opt.env = Object.assign({}, process.env, { AUDIODEV: opt.device });
	}

	rec = spawn('rec', rec_args, rec_opt);

	if (opt.verbose) {
		rec.stdout.on('data', function (data) {
			console.debug(TAG, 'recording');
		});
	}

	rec.stdout.on('end', function () {
		console.debug(TAG, 'end');
	});

	return rec.stdout;
};

exports.stop = function () {
	if (null == rec) return;
	rec.kill();
};