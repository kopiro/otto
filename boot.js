// Replace the console with a better console with colors
require('console-ultimate/global').replace();

// Define constants
global.__basedir = __dirname;
global.__tmpdir = __dirname + '/tmp';
global.__cachedir = __dirname + '/cache';
global.__publicdir = __dirname + '/public';
global.__etcdir = __dirname + '/etc';

global.ERRMSG_SR_GENERIC = "Scusami, ma in questo momento sono confuso...";
global.ERRMSG_SR_UNRECOGNIZED = "Scusami, ma non ho capito quello che hai detto!";

// Read the config and expose as global
global.config = require('./config.json');
global.public_config = require('./public_config.json');

// Current Session ID
global.CLIENT_ID = (function() {
	try { return config.clientId; } 
	catch (err) { return require('os').hostname(); }
})();

// Const
global.AI_NAME_ACTIVATOR = /(^(otto|8)\b)|(\b(otto|8)\b)/mgi;

// Define a new require to require files from our path
global.apprequire = ((k) => require(__basedir + '/src/lib/' + k));

global.mongoose = require('mongoose');
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://' + config.mongo.user + ':' + config.mongo.password + '@' + config.mongo.host + ':' + config.mongo.port + '/' + config.mongo.database);

// Global (App) packages
global.Data = require(__basedir + '/src/data');
global.AI = require(__basedir + '/src/ai');
global.Util = require(__basedir + '/src/util');
global.IOManager = require(__basedir + '/src/iomanager');
global.Scheduler = require(__basedir + '/src/iomanager');
global.Actions = require(__basedir + '/src/actions');

console.info('Boot complete');
