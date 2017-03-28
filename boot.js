require('console-ultimate/global').replace();

global.__basedir = __dirname;
global.__tmpdir = __dirname + '/tmp';
global.__cachedir = __dirname + '/cache';

global.config = require('./config.json');
global.public_config = require('./public_config.json');

global.apprequire = function(k) {
	return require(__basedir + '/support/' + k);
};

global.AI_NAME = "Otto";

global._ = require('underscore');
global.path = require('path');
global.fs = require('fs');
global.request = require('request');
global.async = require('async');
global.moment = require('moment');
global.util = require('util');

global.DB = require('mysql').createConnection(config.mysql);

global.AI = require(__basedir + '/apiai');
global.Memory = require(__basedir + '/memory');
global.Util = require(__basedir + '/util');

///////////////////
// Configuration //
///////////////////

moment.locale(config.language);