// Replace the console with a better console with colors
require('console-ultimate/global').replace();

// Define constants
global.__basedir = __dirname;
global.__tmpdir = __dirname + '/tmp';
global.__cachedir = __dirname + '/cache';
global.__publicdir = __dirname + '/public';
global.__etcdir = __dirname + '/etc';

// Read the config and expose as global
global.config = require('./config.json');
global.public_config = require('./public_config.json');

if (config.uid == null) {
	console.error("Please define config.uid with your Universal ID (username)");
	process.exit(1);
}

global.ERRMSG_SR_GENERIC = [ 
	'In questo momento sono confuso...'
];
global.ERRMSG_SR_UNRECOGNIZED = [ 
	'Scusa, ma non ho capito quello che hai detto!'
];
global.ERRMSG_CANTHANDLE = [ 
	'Cosa vuol dire?',
	'Cosa significa scusa?',
	'Uffa, non capisco...',
	'Cosa vorresti dire?'
];
global.MSG_FIRST_HINT = [
	'Dimmi',
	'Ehi',
	'Weilà',
	'Dica',
	'Spara',
	'Dimmi tutto',
	'Vai'
];

// Const
global.AI_NAME_ACTIVATOR = /(^(otto|8)\b)|(\b(otto|8)\b)/mgi;

// Define a new require to require files from our path
global.apprequire = ((k) => require(__basedir + '/src/lib/' + k));

// Global (App) packages
global.mongoose = require(__basedir + '/src/mongoose');
global.Data = require(__basedir + '/src/data');
global.AI = require(__basedir + '/src/ai');
global.Util = require(__basedir + '/src/util');
global.IOManager = require(__basedir + '/src/iomanager');
global.Scheduler = require(__basedir + '/src/iomanager');
global.Actions = require(__basedir + '/src/actions');