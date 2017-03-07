module.exports = function(args, cb) {
	const mpc = require('child_process').spawn("mpc", args, { stdio: 'pipe' });
	let result = [];

	mpc.stdout.on('data', (data) => {
		result.push(data.toString());
	});

	mpc.on('close', () => {
		if (null != cb) cb(null, result);
	});

	mpc.on('error', (err) => {
		console.error(TAG, err);
		if (null != cb) cb(err);
	});
};