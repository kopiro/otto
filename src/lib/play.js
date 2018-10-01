const TAG = 'Play';

const _ = require('underscore');
const fs = require('fs');
const spawn = require('child_process').spawn;
const md5 = require('md5');
const request = require('request');

const _config = config.play;

const processes = {};

function getLocalObject(uri) {
	return new Promise((resolve) => {
		if (/^https?\:\/\//.test(uri)) {
			const local_file = __cachedir + '/' + md5(uri) + '.mp3';
			if (fs.existsSync(local_file)) {
				return resolve(local_file);
			}

			const local_file_stream = fs.createWriteStream(local_file);

			return request(uri)
			.pipe(local_file_stream)
			.on('close', () => {
				resolve(local_file);
			});
		}

		return resolve(uri);
	});
}

exports.kill = function() {
	for (let pid of Object.keys(processes)) {
		process.kill(pid);
		delete processes[pid];
	}
	return exports;
};

/**
 * Play an item
 * @param {String} uri	URI or file
 * @param {Array} addArgs	Eventual voice effects
 */
exports.playURI = async function(uri, addArgs = [], program = 'play') {
	return new Promise(async(resolve, reject) => {
		let localUri = await getLocalObject(uri);

		const proc = spawn(program, [localUri].concat(addArgs));
		processes[proc.pid] = true;

		proc.on('close', (err) => {
			delete processes[proc.pid];
			if (err) return reject(err);
			resolve(localUri);
		});
	});
};

/**
 * Play an item using voice effects
 * @param {String} file 
 */
exports.playVoice = async function(uri) {
	return exports.playURI(uri, _config.addArgs);
};

/**
 * Play an item using voice effects to a temporary file
 * @param {*} uri 
 */
exports.playToTempFile = function(uri) {
	const tempFile = __tmpdir + '/' + uuid() + '.mp3';
	return exports.playURI(uri, [ tempFile ].concat(_config.addArgs), 'sox');
};