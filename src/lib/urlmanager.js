const spawn = require('child_process').spawn;

exports.open = function(url) {
	return new Promise((resolve, reject) => {
		spawn('open', [ url ]);
		resolve();
	});
};