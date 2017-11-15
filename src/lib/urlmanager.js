const spawn = require('child_process').spawn;

exports.open = function(url) {
	spawn('open', [ url ]);
};