/*
Recursively search for webpack.config.js in subdirectories
and call webpack on that directory to build all modules
*/

const path = require('path');
const glob = require('glob');
const exec = require('child_process').execSync;

console.log('Searching for webpack.config.js...');

let files = [];
files.push('server/webpack.config.js');
files = files.concat(glob.sync('src/**/webpack.config.js', { 
	matchBase: true,
	nodir: true
}));

files.map((e) => {
	console.log(e);
	exec(__dirname + '/node_modules/.bin/webpack', { 
		cwd: path.dirname(e), 
		stdio: [0,1,2] 
	});
});