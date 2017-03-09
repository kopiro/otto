const TAG = 'API.AI';

const apiaiClient = require('apiai')(config.APIAI_TOKEN, {
	language: config.language
});

exports.textRequest = function(data, text, io) {
	return new Promise((resolve, reject) => {
		text = (text || '').replace(AI_NAME_REGEX, '');

		data = _.defaults(data || {}, {
			sessionId: Date.now()
		});

		let request = apiaiClient.textRequest(text, data);

		request.on('response', (response) => {
			let result = response.result;
			console.log(TAG, result);

			if (_.isFunction(Actions[result.action])) {
				Actions[result.action]()(result, io)
				.then(resolve)
				.catch(reject);
			} else if (result.fulfillment.speech) {
				resolve({ text: result.fulfillment.speech });
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