global.config = require('./config.json');
global.IO = require('./io/' + (process.argv[2] || config.io_driver));
global.Memory = require('./memory');

[
[ 'warn',  '\x1b[35m' ],
[ 'error', '\x1b[31m' ],
[ 'info',   '\x1b[2m' ],
[ 'debug',   '\x1b[30m' ],
[ 'user',   '\x1b[35m' ],
[ 'ai',   '\x1b[35m' ],
].forEach(function(pair) {
	var method = pair[0], reset = '\x1b[0m', color = '\x1b[36m' + pair[1];
	console[method] = (console[method] || console.log).bind(console, color, '[' + method.toUpperCase() + ']', reset);
});