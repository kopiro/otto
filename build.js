const path = require('path');
const glob = require('glob');
const exec = require('child_process').execSync;

glob.sync('webpack.config.js', { 
	matchBase: true,
	nodir: true
}).map((e) => {
	console.log(e);
	exec('webpack', { cwd: path.dirname(e), stdio:[0,1,2] });
});