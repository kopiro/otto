const TAG = 'LumenVoxHack';
const BASE = 'http://www.lumenvox.com/products/tts';
const hack_headers = {
	'Referer': 'http://www.lumenvox.com/products/tts/',
	'X-Requested-With': 'XMLHttpRequest',
	'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_2)'
};

const cache_file = __cachedir + '/lumenvox.json';
if (!fs.existsSync(cache_file)) fs.writeFileSync(cache_file, '{}');
let cache = require(cache_file);

function download(text, callback) {
	if (cache[text]) {
		console.debug(TAG, 'text in cache');
		callback(null, cache[text]);
	} else {
		request({
			url: `${BASE}/processTTS.ashx`,
			method: 'POST',
			headers: hack_headers,
			form: {
				msg: text,
				voice: 'Emilia',
				engine: 1
			}
		}, (err, response, body) => {
			if (err) return callback(err);

			let path = (body.match(/\<path\>(.+)\<\/path\>/) || []).pop();
			if (path == null) return callback('Path null');

			let rpath = `${BASE}/audio/${path}`;
			let file_check = 0;

			const checkFileExists = () => {
				console.debug(TAG, 'Checking file exists', rpath);
				request({
					url: `${BASE}/fileReady.ashx`,
					method: 'POST',
					headers: hack_headers,
					form: {
						fileName: path
					}
				}, (err, resp, body) => {
					if (err || false == /\<exists\>1\<\/exists\>/.test(body)) {
						console.debug(TAG, 'File not yet ready');
						if (file_check++ >= 5) {
							console.error(TAG, 'Reached max file requests');
							return callback({ message: 'Reached max file requests' });
						}

						return setTimeout(checkFileExists, 500);
					}

					const dpath = __cachedir + '/lumenxvox_' + path;
					request(rpath)
					.pipe(fs.createWriteStream(dpath))
					.on('error', (err) => {
						callback(err);
					})
					.on('finish', () => {
						cache[text] = dpath;
						fs.writeFile(cache_file, JSON.stringify(cache), () => {});
						callback(null, cache[text]);
					});
				});
			};
			checkFileExists();

		});
	}
}

exports.play = function(text, callback) {
	download(text, (err, file) => {
		if (err) {
			console.error(TAG, err);
			return callback(err);
		}

		require('child_process').spawn(__basedir + '/player.sh', [ file ])
		.addListener('exit', (err, stdout, stderr) => {
			if (err) {
				console.error(TAG, err, stdout, stderr);
				return callback(err);
			}

			callback();
		});
	});
};
