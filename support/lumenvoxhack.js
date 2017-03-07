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
	text = text.trim();

	if (cache[text]) {
		console.debug(TAG, 'text in cache', text);
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

			console.debug(TAG, text, path);

			const checkFileExists = () => {
				request({
					url: `${BASE}/fileReady.ashx`,
					method: 'POST',
					headers: hack_headers,
					form: {
						fileName: path
					}
				}, (err, resp, body) => {
					if (err || false == /\<exists\>1\<\/exists\>/.test(body)) {
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
						console.debug(TAG, text, dpath);
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
	// Split large text in multiple textes
	text = _.compact(text.split(/(?:\.|\!|\?|\.\.\.)(?:\s+|\n)/g));

	let i = 0;
	async.map(text, (t, next) => {
		// Do a timeout because lumenvox
		// doesn't accept parallel requests
		setTimeout(() => {
			download(t, (err, file) => {
				if (err) {
					console.error(TAG, err);
					return next(err);
				}

				next(null, file);
			});
		}, (i++) * 200);
	}, (err, files) => {
		async.eachSeries(files, (file, next) => {
			require('child_process').spawn('play', [ file, 'pitch', '-q', '800' ])
			.addListener('exit', next);
		}, callback);
	});
};

exports.playToFile = function(text, callback) {
	// Split large text in multiple textes
	text = _.compact(text.split(/(?:\.|\!|\?|\.\.\.)(?:\s+|\n)/g));

	let i = 0;
	async.map(text, (t, next) => {
		// Do a timeout because lumenvox
		// doesn't accept parallel requests
		setTimeout(() => {
			download(t, (err, file) => {
				if (err) {
					console.error(TAG, err);
					return next(err);
				}

				next(null, file);
			});
		}, (i++) * 200);
	}, (err, files) => {
		const audio_combined_out = __tmpdir + '/' + Date.now() + '.wav';
		files = files.concat(audio_combined_out, 'pitch', '-q', '800');
		
		require('child_process').spawn('sox', files)
		.on('close', (code) => {
			if (code !== 0) return callback({});
			callback(null, audio_combined_out);
		});
	});
};
