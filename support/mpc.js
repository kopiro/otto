const TAG = 'MPC';

function raw(args, callback) {
	console.debug(TAG, 'raw', args);
	callback = callback || function(){};

	args.push('--quiet');
	const mpc = require('child_process').spawn("mpc", args);

	let result = [];
	let error = [];

	mpc.stdout.on('data', (data) => {
		result.push(data.toString().replace('\n', ''));
	});

	// mpc.stderr.on('data', (data) => {
	// 	error.push(data.toString().replace('\n', ''));
	// });

	mpc.on('close', (code) => {
		console.debug(TAG, 'close', result);
		if (code == 0) {
			callback(null, result);
		} else {
			callback(error);
		}
	});
}

exports.raw = raw;

exports.setVolume = function(vol, callback) {
	raw(['volume', vol], callback);
};

exports.getCurrent = function(callback) {
	callback = callback || function(){};	
	raw(['current'], (err, result) => {
		if (err) return callback(err);
		const result_split = result[0].split(' - ');
		callback(null, {
			artist: result_split[0],
			track: result_split[1]
		});
	});
};

exports.play = function(url, callback) {
	callback = callback || function(){};	
	raw(['clear'], (err) => {
		if (err) return callback(err);
		raw(['insert', url], (err) => {
			if (err) return callback(err);
			raw(['play'], callback);
		});
	});
};