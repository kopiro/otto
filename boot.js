const _ = require('underscore');
const assignDeep = require('assign-deep');

// Replace the console with a better console with colors
require('console-ultimate/global').replace();

// Define constants
global.__basedir = __dirname;
global.__tmpdir = `${__dirname}/tmp`;
global.__cachedir = `${__dirname}/cache`;
global.__etcdir = `${__dirname}/etc`;
global.__keysdir = `${__dirname}/keys`;
global.__tmpsecretdir = `${__dirname}/tmp-secret`;

global.__package = require(`${__basedir}/package.json`);

// Read the config and expose as global
global.config = assignDeep(require('./default-config.json'), require('./config.json'));

if (config.uid == null) {
  console.error('Please define config.uid with your Universal ID (username)');
  process.exit(1);
}

global.AI_NAME_REGEX = new RegExp(config.aiNameRegex, 'mgi');

if (config.raven) {
  global.Raven = require('raven');
  global.Raven.config(config.raven).install();
} else {
  console.warn('Raven not configured');
}

// Global (App) packages
require(`${__basedir}/src/helpers`);

global.mongoose = require(`${__basedir}/src/mongoose`);
global.Data = require(`${__basedir}/src/data`);
global.AI = require(`${__basedir}/src/ai`);
global.IOManager = require(`${__basedir}/src/iomanager`);
global.Scheduler = require(`${__basedir}/src/scheduler`);
global.Actions = require(`${__basedir}/src/actions`);
