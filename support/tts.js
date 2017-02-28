const _config = config.ai.cognitive;
const util = require('util');
const TAG = 'TTS';

function getAccessToken(callback) {
	request({
		url: 'https://api.cognitive.microsoft.com/sts/v1.0/issueToken',
		method: 'POST',
		json: true,
		headers: {
			'Ocp-Apim-Subscription-Key': _config.speechApiKey
		}
	}, (err, resp, body) => {
		if (err) {
			console.error(TAG, err);
			return callback(err);
		}

		try {
			const accessToken = body;
			if (accessToken) {
				callback(null, accessToken);
			} else {
				callback(body);
			}
		} catch(e) {
			callback(e);
		}
	});
}

function textToSpeech(text, filename, accessToken, callback) {
	var ssmlTemplate = "<speak version='1.0' xml:lang='en-us'><voice xml:lang='%s' xml:gender='%s' name='%s'>%s</voice></speak>";

	request.post({
		url: 'http://speech.platform.bing.com/synthesize',
		body: util.format(ssmlTemplate, 'it-IT', 'Female', 'Microsoft Server Speech Text to Speech Voice (it-IT, Cosimo, Apollo)', text),
		encoding: null,
		headers: {
			'Authorization': `Bearer ${accessToken}`,
			'Content-Type' : 'application/ssml+xml',
			'X-Microsoft-OutputFormat' : 'riff-16khz-16bit-mono-pcm'
		}
	}, (err, resp, body) => {
		if (err) {
			console.error(TAG, err);
			return callback(err);
		}

		fs.writeFile(filename, body, 'binary', (err) => {
			if (err) return callback(err);	
			console.debug(TAG, 'written file', filename);		
			callback(null);
		});
	});
}

exports.synthesize = function(str) {
	return new Promise((resolve, reject) => {
		const tmp_file = require('os').tmpdir() + '/synthesize_' + Date.now() + '.wav';
		getAccessToken((err, accessToken) => {
			if (err) return reject(err);
			textToSpeech(str, tmp_file, accessToken, (err) => {
				if (err) return reject(err);
				resolve(tmp_file);
			});
		});
	});
};

exports.play = function(str) {
	return new Promise((resolve, reject) => {
		exports.synthesize(str)
		.then((file) => {
			return require('child_process').spawn(__basedir + '/player.sh', [ file ])
			.addListener('exit', (err) => {
				// fs.unlinkSync(file);
				if (err) return reject(err);
				resolve();
			});
		})
		.catch((err) => {
			reject(err);
		});
	});
};
