const _config = config.cognitive;
const util = require('util');

function getAccessToken(clientId, clientSecret, callback) {
	request.post({
		url: 'https://oxford-speech.cloudapp.net/token/issueToken',
		form: {
			'grant_type': 'client_credentials',
			'client_id': encodeURIComponent(clientId),
			'client_secret': encodeURIComponent(clientSecret),
			'scope': 'https://speech.platform.bing.com'
		}
	}, (err, resp, body) => {
		if (err) return callback(err);
		try {
			let accessToken = JSON.parse(body).access_token;
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
		body: util.format(ssmlTemplate, 'it-IT', 'Female', 'Microsoft Server Speech Text to Speech Voice (it-IT, ZiraRUS)', text),
		encoding: null,
		headers: {
			'Authorization': `Bearer ${accessToken}`,
			'Content-Type' : 'application/ssml+xml',
			'X-Microsoft-OutputFormat' : 'riff-16khz-16bit-mono-pcm',
			'X-Search-AppId': 'otto',
			'X-Search-ClientID': _config.apiKey
		}
	}, (err, resp, body) => {
		if (err) return callback(err);

		fs.writeFile(filename, body, 'binary', (err) => {
			if (err) return callback(err);
			
			callback(null);
		});
	});
}

exports.recognize = function() {
	return new Promise((resolve, reject) => {
		getAccessToken(clientId, clientSecret, (err, accessToken) => {
			if (err) return reject(err);

			textToSpeech(str, '/tmp/test.wav', accessToken, (err) => {
				if (err) return reject(err);

				console.log('Wrote out: ' + 'test.wav');
			});
		});
	});
};
