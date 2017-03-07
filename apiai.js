const TAG = 'API.AI';

const apiaiClient = require('apiai')(config.APIAI_TOKEN, {
	language: config.language
});

exports.textRequest = function(data, text, io) {
	return new Promise((resolve, reject) => {
		text = (text || '').replace(AI_NAME_REGEX, '');

		_.defaults(data, {
			sessionId: '1'
		});

		let request = apiaiClient.textRequest(text, data);

		request.on('response', (response) => {
			let r = response.result;

			if (_.isFunction(Actions[r.action])) {
				Actions[r.action](r, io)
				.then(resolve)
				.catch(reject);
			} else if (r.fulfillment.speech) {
				resolve({ text: r.fulfillment.speech });
			} else {
				reject({ noStrategy: true });
			}
		});

		request.on('error', (err) => {
			console.error(TAG, 'response error', err);
			reject(err);
		});

		request.end();
	});
};