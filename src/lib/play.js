const TAG = 'Play';

const _ = require('underscore');
const fs = require('fs');
const spawn = require('child_process').spawn;
const md5 = require('md5');
const request = require('request');

const _config = config.play;

exports.speakerProc = null;

exports.fileToSpeaker = function(file) {
	return new Promise((resolve, reject) => {
		console.debug(TAG, 'fileToSpeaker', file);

		const opt = {};
		let bargs = [];
		let args = [];

		exports.speakerProc = spawn('play', bargs.concat(file).concat(_config.addArgs).concat(args), opt);
		exports.speakerProc.on('close', (err) => {
			exports.speakerProc = null;
			if (err) return reject(err);
			resolve(true);
		});
	});
};

exports.urlToSpeaker = function(url) {
	return new Promise(async(resolve) => {
		console.debug(TAG, 'urlToSpeaker', { url });
	
		const audio_file = __cachedir + '/' + md5(url) + '.mp3';
		if (fs.existsSync(audio_file)) {
			return exports.fileToSpeaker(audio_file);
		}

		const audio_file_stream = fs.createWriteStream(audio_file);

		request(url)
		.pipe(audio_file_stream)
		.on('close', async() => {
			await exports.fileToSpeaker(audio_file);
			resolve(true);
		});
	});
};

exports.fileToTmpFile = function(file) {
	return new Promise((resolve, reject) => {
		const tmp_file = __tmpdir + '/' + uuid() + '.mp3';
		console.debug(TAG, 'fileToTmpFile', { file, tmp_file });

		let proc = spawn('sox', [file].concat(tmp_file).concat(_config.addArgs));
		let stderr = '';
		proc.stderr.on('data', (buf) => { stderr += buf; });
		proc.on('close', (err) => {
			if (err) return reject(stderr);
			resolve(tmp_file);
		});
	});
};