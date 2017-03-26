const TAG = 'API.AI';

const apiaiClient = require('apiai')(config.APIAI_TOKEN, {
	language: config.language
});

const AI_NAME_REGEX = /^(?:Otto(,\s*)?)|(\s*Otto)$/i;
const actions = require(__basedir + '/actions');

exports.textRequest = function(text, data) {
	return new Promise((resolve, reject) => {
		text = text.replace(AI_NAME_REGEX, '');

		let request = apiaiClient.textRequest(text, data);
		console.debug(TAG, 'textRequest', text);

		request.on('response', (res) => {
			console.debug(TAG, 'response', JSON.stringify(res, null, 2));
			let fulfillment = res.result.fulfillment;
			fulfillment.data = fulfillment.data || {};

			// Try to resolve this action locally if no webhook is used
			if (res.result.metadata.webhookUsed == "false") {

				if (res.result.actionIncomplete === false) {
					const action = actions[res.result.action];
					if (_.isFunction(action)) {
						return action()(res)
						.then((local_fulfillment) => {
							console.debug(TAG, 'local fulfillment', local_fulfillment);
							resolve(local_fulfillment);
						})
						.catch((err) => {
							reject(err);
						});
					} else {
						console.error(TAG, `action ${res.result.action} not exists`);
					}
				}

			} else {
				// Edit msg from API.AI to reflect IO interface
				if (!_.isEmpty(res.result.fulfillment.messages)) {
					let msg = res.result.fulfillment.messages.getRandom();
					switch (msg.type) {
						case 2:
						fulfillment.data.replies = msg.replies;
						break;
						case 3:
						fulfillment.data = { image: { remoteFile: msg.imageUrl } };
						break;
						case 4:
						fulfillment.data = msg.payload;
						break;
						default:
						console.error(TAG, 'Type not recognized');
						break;
					}
					delete fulfillment.messages;
				}
			}

			resolve(fulfillment);
		});

		request.on('error', (err) => {
			console.error(TAG, 'error', err);
			reject(err);
		});

		request.end();
	});
};