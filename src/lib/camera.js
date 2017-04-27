const TAG = 'Camera';

const spawn = require('child_process').spawn;
const IS_RPI = () => {
	try {
		require('child_process').execSync('which raspistill');
		return true;
	} catch (ex) {
		return false;
	}
}();

const Drivers = {};

Drivers.raspi = {
	takePhoto: function(opt) {
		return new Promise((resolve, reject) => {
			const args = [ 
			'-w', opt.width,
			'-h', opt.height,
			'-o', opt.file,
			'-t', 300,
			'-e', 'jpg',
			];

			const proc = spawn('raspistill', args);

			let err = "";
			proc.stderr.on('data', (data) => { err += data; });

			proc.on('close', (code) => {
				if (code > 0) return reject(err);
				resolve(opt.file);
			});
		});
	},
	/*
	raspivid -t 300000 -w 1280 -h 720 -b 2000000 -fps 30 -n -awb fluorescent -sa -10 -br 60 -co 50 -o v.h264 | \
   arecord -D plug:default -f S16_LE -c 1 -r 16000 -d 300 a.wav; \
   ffmpeg -y -i a.wav  -r 30 -i v.h264  -filter:a aresample=async=1 -c:a flac -c:v copy av.mkv
	 */
	recordVideo: function(opt) {
		return new Promise((resolve, reject) => {
			const args = [ 
			'-w', opt.width,
			'-h', opt.height,
			'-fps', opt.fps,
			'-t', opt.time * 1000,
			'-o', opt.file + '.h264',
			];

			const proc = spawn('raspivid', args);

			let err = "";
			proc.stderr.on('data', (data) => { err += data; });

			proc.on('close', (code) => {
				if (code > 0) return reject(err);

				// Wrap the video in mp4
				spawn('MP4Box', [ '-add', opt.file + '.h264', opt.file ])
				.on('close', () => {
					// So unlink the old file
					fs.unlink(opt.file + '.h264', () => {});
					resolve(opt.file);
				});
			});
		});
	},
};

Drivers.ffmpeg = {
	takePhoto: function(opt) {
		return new Promise((resolve, reject) => {
		
			_.defaults(opt, {
				source: 'avfoundation'
			});

			const args = [ 
			'-r', opt.fps,
			'-f', opt.source,
			'-i', 0,
			'-s', (opt.width + 'x' + opt.height),
			'-vframes', 1,
			'-y', 
			opt.file
			];

			const proc = spawn('ffmpeg', args);

			let err = "";
			proc.stderr.on('data', (data) => { err += data; });

			proc.on('close', (code) => {
				if (code > 0) return reject(err);

				resolve(opt.file);
			});
		});
	},
	recordVideo: function(opt) {
		return new Promise((resolve, reject) => {

			_.defaults(opt, {
				source: 'avfoundation'
			});

			const args = [ 
			'-r', opt.fps,
			'-f', opt.source,
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
			opt.file
			];

			const proc = spawn('ffmpeg', args);

			let err = "";
			proc.stderr.on('data', (data) => { err += data; });

			proc.on('close', (code) => {
				if (code > 0) return reject(err);
				resolve(opt.file);
			});
		});
	}
};

const driver = Drivers[ IS_RPI ? 'raspi' : 'ffmpeg' ];

exports.takePhoto = function(opt) {
	opt = _.defaults(opt || {}, {
		width: 640,
		height: 480,
		file: __tmpdir + '/cam_' + uuid() + '.jpg'
	});

	return driver.takePhoto(opt);
};

exports.recordVideo = function(opt) {
	opt = _.defaults(opt || {}, {
		width: 640,
		height: 480,
		fps: 30,
		time: 10,
		file: __tmpdir + '/cam_' + uuid() + '.mp4'
	});

	return driver.recordVideo(opt);
};