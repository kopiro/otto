const TAG = 'Rec';

const spawn = require('child_process').spawn;
const stream = require('stream');

let recstream;
let rec;

// returns a Readable stream
exports.start = function(opt) {
	_.defaults(opt, {
		sampleRate: 16000,
		compress: true
	});

	recstream = new stream.PassThrough();

	rec = spawn('rec', [
	'-q',
	'-r', opt.sampleRate,
	'-c', '1',
	'-e', 'signed-integer',
	'-b', '16',
	'-t', 'wav',
	'-',
	]);

	rec.stdout.setEncoding('binary');
	rec.stdout.on('data', (data) => {
		try {
			recstream.write(new Buffer(data, 'binary'));
		} catch (ex) {
			console.error(TAG, ex.message);
		}
	});

	return recstream;
};

exports.stop = function () {
	recstream.end();
	rec.kill();
	return recstream;
};