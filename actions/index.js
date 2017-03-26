(function iterate(dir) {
	fs.readdirSync(dir).forEach(function(file) {
		file = dir + '/' + file;
		const stat = fs.lstatSync(file);
		if (stat.isDirectory()) {
			iterate(file);
		} else if (stat.isFile()) {
			if (/\.js$/.test(file)) {
				const action_name = file
				.replace('/index.js', '')
				.replace(__dirname, '')
				.replace(/^./, '')
				.replace(/\//g, '.')
				.replace('.js','');
				if (action_name) {
					exports[action_name] = function() { 
						let mod = require(file); 
						mod.id = action_name;
						return mod;
					};
				}
			}
		}
	});
})(__dirname);