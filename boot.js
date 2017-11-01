// Replace the console with a better console with colors
require('console-ultimate/global').replace();

// Define constants
global.__basedir = __dirname;
global.__tmpdir = __dirname + '/tmp';
global.__cachedir = __dirname + '/cache';
global.__publicdir = __dirname + '/public';

global.ERRMSG_SR_GENERIC = "Scusami, ma in questo momento sono confuso...";
global.ERRMSG_SR_UNRECOGNIZED = "Scusami, ma non ho capito quello che hai detto!";

// Read the config and expose as global
global.config = require('./config.json');
global.public_config = require('./public_config.json');

// Current Session ID
global.clientId = (function() {
	try { return config.clientId; } 
	catch (err) { return require('os').hostname(); }
})();

// Const
global.AI_NAME = "Otto";
global.AI_NAME_ACTIVATOR = /(^(otto|8)\b)|(\b(otto|8)\b)/mgi;

// Define a new require to require files from our path
global.apprequire = ((k) => require(__basedir + '/src/lib/' + k));

// Global packages
global._ = require('underscore');
global.path = require('path');
global.fs = require('fs');
global.request = require('request');
global.async = require('async');
global.moment = require('moment');
moment.locale(config.language);
global.util = require('util');
global.spawn = require('child_process').spawn;

global.mongoose = require('mongoose');
// Set global promise to ES promises
mongoose.Promise = global.Promise;

// DB Connect
global.db = mongoose.connect('mongodb://' + config.mongo.user + ':' + config.mongo.password + '@' + config.mongo.host + ':' + config.mongo.port + '/' + config.mongo.database, { useMongoClient: true });

// Global (App) packages
global.AI = require(__basedir + '/src/ai');
global.Data = require(__basedir + '/src/data');
global.Util = require(__basedir + '/src/util');
global.IOManager = require(__basedir + '/src/iomanager');
global.Actions = require(__basedir + '/src/actions');
global.SchedulerManager = require(__basedir + '/src/schedulermanager');

console.info('Boot complete');
