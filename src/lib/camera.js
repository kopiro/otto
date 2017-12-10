const TAG = 'Camera';

const _ = require('underscore');
const fs = require('fs');
const spawn = require('child_process').spawn;
const exec = require('child_process').exec;

const IS_RPI = (() => {
	try {
		require('child_process').execSync('which raspistill');
		return true;
	} catch (ex) {
		return false;
	}
})();

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
	recordVideo: function(opt) {
		return new Promise((resolve, reject) => {
			const raspivid_time = opt.time * 1000;

			const file_h264 = __tmpdir + '/' + uuid() + '.h264';
			const file_wav = __tmpdir + '/' + uuid() + '.wav';

			exec([
			`raspivid -t ${raspivid_time} -w ${opt.width} -h ${opt.height} -b 2000000 -fps ${opt.fps} -n -o "${file_h264}" | ` + 
			`arecord -f S16_LE -c 1 -r 16000 -d ${opt.time} "${file_wav}"`,
			`ffmpeg -y -i "${file_wav}" -r ${opt.fps} -i "${file_h264}" -filter:a aresample=async=1 -c:a flac -c:v copy "${opt.file}"`,
			].join(' && '), (err, stdout, stderr) => {
				fs.unlink(file_h264, () => {});
				fs.unlink(file_wav, () => {});
				if (err) return reject(stderr);
				resolve(opt.file);
			});

		});
	},
};

Drivers.ffmpeg = {
	takePhoto: function(opt) {
		return new Promise((resolve, reject) => {
			const args = [ 
			'-r', 30,
			'-f', 'avfoundation',
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
			const args = [ 
			'-r', opt.fps,
			'-f', 'avfoundation',
			'-i', '0:0',
			'-t', opt.time,
			'-s', opt.size,
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

exports.takePhoto = function(opt = {}) {
	_.defaults(opt, {
		width: 640,
		height: 480,
		file: __tmpdir + '/cam_' + uuid() + '.jpg'
	});

	return driver.takePhoto(opt);
};

exports.recordVideo = function(opt = {}) {
	_.defaults(opt, {
		width: 640,
		height: 480,
		fps: 30,
		time: 10,
		file: __tmpdir + '/cam_' + uuid() + '.mkv'
	});

	return driver.recordVideo(opt);
};