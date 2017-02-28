require('../boot');

const TAG = 'Impersonator';
const IO = require(__basedir + '/io/telegram');

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let data = null;
try {
	data = JSON.parse(process.argv[2] || '');
} catch (ex) {
	console.error('Unable to parse initial data', process.argv[2]);
	process.exit();
}

console.info('Data', data);

(function ask() {
	rl.question('> ', (text) => {
		IO.output(data, text)
		.then(ask)
		.catch(ask);
	});
})();