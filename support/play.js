const TAG = 'Play';

const spawn = require('child_process').spawn;
const PITCH = 700;

exports.fileToSpeaker = function(file, callback) {
	spawn('play', [file].concat('pitch', '-q', PITCH))
	.on('close', callback);
};

exports.fileToFile = function(file, callback) {
	const tmp_audio = __tmpdir + '/' + require('uuid').v4() + '.mp3';
	spawn('play', files.concat(tmp_audio).concat('pitch', '-q', PITCH))
	.on('close', () => {
		callback(null, tmp_audio);
	});
};