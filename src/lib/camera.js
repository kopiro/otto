const TAG = 'Camera';

const spawn = require('child_process').spawn;

exports.takePhoto = function(opt) {
	return new Promise((resolve, reject) => {

		opt = _.defaults(opt || {}, {
			size: '640x480'
		});

		const file = __tmpdir + '/webcam_' + uuid() + '.jpeg';
		const args = [ 
		'-r', 30,
		'-f', 'avfoundation',
		'-i', 0,
		'-s', opt.size,
		'-vframes', 1,
		'-y', 
		file
		];

		console.log(args.join(' '));
		
		const ffmpeg = spawn('ffmpeg', args);

		let err = "";
		ffmpeg.stderr.on('data', (data) => {
			err += data;
		});

		ffmpeg.on('close', (code) => {
			if (code > 0) return reject(err);
			resolve(file);
		});

	});
};