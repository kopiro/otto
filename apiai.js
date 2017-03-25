const TAG = 'API.AI';

const apiaiClient = require('apiai')(config.APIAI_TOKEN, {
	language: config.language
});

const AI_NAME_REGEX = /^(?:Otto(,\s*)?)|(\s*Otto)$/i;

exports.textRequest = function({ data, text, io }) {
	return new Promise((resolve, reject) => {
		text = text.replace(AI_NAME_REGEX, '');

		let request = apiaiClient.textRequest(text, data);
		console.debug(TAG, 'textRequest', text);

		request.on('response', (response) => {
			let result = response.result;
			let fulfillment = result.fulfillment;
			console.debug(TAG, 'response', JSON.stringify(result, null, 2));

			if (!_.isEmpty(result.action) && result.actionIncomplete == false) {
				if (_.isFunction(Actions[result.action])) {
					return Actions[result.action]()(result, {
						io: io,
						data: data
					})
					.then(resolve)
					.catch(reject);
				} else {
					console.error(TAG, `action ${result.action} not found`);
				}
			}

			if (!_.isEmpty(fulfillment.speech)) {
				return resolve({ 
					text: fulfillment.speech 
				});
			}

			if (!_.isEmpty(fulfillment.messages)) {
				let msg = fulfillment.messages.getRandom();
				if (!_.isEmpty(msg.replies)) {
					return resolve({
						text: fulfillment.messages[0].title,
						replies: fulfillment.messages[0].replies
					});
				} else if (msg.imageUrl != null) {
					return resolve({ 
						image: { 
							remoteFile: msg.imageUrl 
						} 
					});
				}
			}

			reject({ noStrategy: true });
		});

		request.on('error', (err) => {
			console.error(TAG, 'response error', err);
			reject(err);
		});

		request.end();
	});
};