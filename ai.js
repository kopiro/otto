const files = require('fs').readdirSync('./ai');

files.forEach(function(file) {
	const file_wjs = file.replace('.js','');
	exports[file_wjs] = require('./ai/' + file_wjs);
});