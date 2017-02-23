global.__basedir = __dirname;

global.config = require('./config.json');
global._ = require('underscore');
global.fs = require('fs');
global.request = require('request');
global.async = require('async');
global.moment = require('moment');
moment.locale('it');

global.DB = require('mysql').createConnection(config.mysql);

global.IO = require('./io/' + (process.argv[2] || config.io_driver));

global.SpeechRecognizer = require('./support/speechrecognizer');
global.VisionRecognizer = require('./support/visionrecognizer');
global.FaceRecognizer = require('./support/facerecognizer');
global.Translator = require('./support/translator');

global.Memory = require('./memory');

global.AI_NAME_REGEX = /(otto|8:00)/;

[
[ 'warn',  '\x1b[35m' ],
[ 'error', '\x1b[31m' ],
[ 'info',   '\x1b[2m' ],
[ 'debug',   '\x1b[30m' ],
[ 'user',   '\x1b[35m' ],
[ 'ai',   '\x1b[35m' ],
].forEach(function(pair) {
	var method = pair[0], reset = '\x1b[0m', color = '\x1b[36m' + pair[1];
	var func = console[method] || console.log;
	console[method] = function() {
		func.apply(console, [ color + '[' + method.toUpperCase() + ']' ].concat(_.toArray(arguments)).concat(reset) );
	};
});