const TAG = 'Play';

const spawn = require('child_process').spawn;
const PITCH = 700;

exports.fileToSpeaker = function(file, callback) {
	callback = callback || (() => {});

	spawn('play', [file].concat('pitch', '-q', PITCH))
	.on('close', (err) => {
		callback(err != 0);
	});
};

exports.fileToFile = function(from_file, to_file, callback) {
	callback = callback || (() => {});

	spawn('play', [from_file].concat(to_file).concat('pitch', '-q', PITCH))
	.on('close', (err) => {
		callback(err != 0, to_file);
	});
};

exports.fileToTmpFile = function(file, callback) {
	callback = callback || (() => {});

	const tmp_audio = __tmpdir + '/' + require('uuid').v4() + '.mp3';
	spawn('play', [file].concat(tmp_audio).concat('pitch', '-q', PITCH))
	.on('close', (err) => {
		callback(err != 0, tmp_audio);
	});
};