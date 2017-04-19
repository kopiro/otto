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

exports.recordVideo = function(opt) {
	return new Promise((resolve, reject) => {

		opt = _.defaults(opt || {}, {
			size: '640x480',
			time: 10
		});

		const file = __tmpdir + '/webcam_' + uuid() + '.mp4';
		const args = [ 
		'-r', 30,
		'-f', 'avfoundation',
		'-i', '0:0',
		'-t', opt.time,
		'-s', opt.size,
		// '-an', 
		// '-c:v', 
		// 'libx264', 
		// '-crf', 
		// '26',
		// '-vf', 'scale=640:-1',
		'-y', 
		file
		];
		
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