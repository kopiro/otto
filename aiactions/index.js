const files = require('fs').readdirSync(__dirname);

files.forEach(function(file) {
	if (/\.js$/.test(file)) {
		const file_wjs = file.replace('.js','');
		exports[file_wjs] = require(__dirname + '/' + file_wjs);
	}
});