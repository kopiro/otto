const TAG = 'API.AI';

const apiaiClient = require('apiai')(config.APIAI_TOKEN, {
	language: 'it'
});

const AI_NAME_REGEX = /^(?:Otto(,\s*)?)|(\s*Otto)$/i;
const Actions = require(__basedir + '/actions');

exports.fulfillmentTransformer = function(fulfillment) {
	return new Promise((resolve, reject) => {
		if (config.translateSpeech) {
			if (fulfillment.speech) {
				apprequire('translator').translate(fulfillment.speech, config.language, (err, new_speech) => {
					if (err) return resolve(fulfillment);

					fulfillment.translated = true;
					fulfillment.speech = new_speech;
					
					resolve(fulfillment);
				});
			} else {
				resolve(fulfillment);
			}
		} else {
			resolve(fulfillment);
		}
	});
};

exports.fulfillmentPromiseTransformer = function(promise, data) {
	return new Promise((resolve, reject) => {
		promise(data)
		.then((fulfillment) => { 
			return exports.fulfillmentTransformer(fulfillment); 
		})
		.then(resolve)
		.catch(reject);
	});
};

exports.textRequestTransformer = function(text) {
	return new Promise((resolve, reject) => {
		text = text.replace(AI_NAME_REGEX, '');
		if (config.translateText) {
			apprequire('translator').translate(text, 'it', (err, new_text) => {
				if (err) return resolve(text);
				resolve(new_text);
			});
		} else {
			resolve(text);
		}
	});
};

exports.textRequest = function(text, data) {
	return new Promise((resolve, reject) => {
		exports.textRequestTransformer(text)
		.then((text) => {
			let request = apiaiClient.textRequest(text, data);
			console.debug(TAG, 'textRequest', text);

			request.on('response', (res) => {
				console.debug(TAG, 'response', JSON.stringify(res, null, 2));
				let fulfillment = res.result.fulfillment;
				fulfillment.data = fulfillment.data || {};

				// Try to resolve this action locally if no webhook is used
				if (res.result.metadata.webhookUsed == "false") {

					if (!_.isEmpty(res.result.action) && res.result.actionIncomplete === false) {
						const action_fn_promise = Actions.list[ res.result.action ];
						if (_.isFunction(action_fn_promise)) {
							return exports.fulfillmentPromiseTransformer( action_fn_promise(), res )
							.then(resolve)
							.catch(reject);
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

				exports.fulfillmentTransformer(fulfillment)
				.then(resolve)
				.catch(reject);
			});

			request.on('error', (err) => {
				console.error(TAG, 'error', err);
				reject(err);
			});

			request.end();
		});
	});
};