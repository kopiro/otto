module.exports = function(args, cb) {
	const mpc = require('child_process').spawn("mpc", args, {stdio: 'pipe'});
	let result = [];

	mpc.stdout.on('data', (data) => {
		result.push(data.toString());
	});

	mpc.on('close', () => {
		cb(null, result);
	});

	mpc.on('error', (err) => {
		cb(err);
	});
};