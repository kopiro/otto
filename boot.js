global.__basedir = __dirname;
global.__tmpdir = __dirname + '/tmp';
global.__cachedir = __dirname + '/cache';

global.config = require('./config.json');
global.public_config = require('./public_config.json');

global.AI_NAME_REGEX = /^(otto)/i;

[
[ 'warn',  '\x1b[35m' ],
[ 'error', '\x1b[31m' ],
[ 'info',   '\x1b[2m' ],
[ 'debug',   '\x1b[30m' ],
// Custom methods
[ 'user',   '\x1b[32m' ],
[ 'ai',   '\x1b[33m' ],
].forEach(function(pair) {
	var method = pair[0], reset = '\x1b[0m', color = '\x1b[36m' + pair[1];
	var func = console[method] || console.log;
	console[method] = function() {
		func.apply(console, [ color + '[' + method.toUpperCase() + ']' ].concat(_.toArray(arguments)).concat(reset) );
	};
});

global._ = require('underscore');
global.path = require('path');
global.fs = require('fs');
global.request = require('request');
global.async = require('async');
global.moment = require('moment');
moment.locale(config.language);

global.APIAI = require(__basedir + '/apiai');
global.Actions = require(__basedir + '/actions');
global.DB = require('mysql').createConnection(config.mysql);
global.Memory = require(__basedir + '/memory');
global.Util = require(__basedir + '/util');