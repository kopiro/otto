exports.open = function(url) {
	require('child_process').spawn('open', [ url ]);
};