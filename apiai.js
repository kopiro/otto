const TAG = 'API.AI';

const apiaiClient = require('apiai')(config.APIAI_TOKEN);

const AI_NAME_REGEX = /^(?:Otto(,\s*)?)|(\s*Otto)$/i;
const Actions = require(__basedir + '/actions');

exports.fulfillmentTransformer = function(fulfillment, session_model) {
	return new Promise((resolve, reject) => {
		if (session_model.get('translate_to')) {
			if (!_.isEmpty(fulfillment.speech)) {
				apprequire('translator').translate(fulfillment.speech, session_model.get('translate_to'), (err, new_speech) => {
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

exports.fulfillmentPromiseTransformer = function(promise_fn, body, session_model) {
	return new Promise((resolve, reject) => {
		promise_fn(body, session_model)
		.then((fulfillment) => {
			return exports.fulfillmentTransformer(fulfillment, session_model);
		})
		.then(resolve)
		.catch(reject);
	});
};

exports.textRequestTransformer = function(text, session_model) {
	return new Promise((resolve, reject) => {
		text = text.replace(AI_NAME_REGEX, '');
		if (session_model.get('translate_to')) {
			apprequire('translator').translate(text, 'it', (err, new_text) => {
				if (err) return resolve(text, session_model);
				resolve(new_text);
			});
		} else {
			resolve(text);
		}
	});
};

exports.textRequest = function(text, session_model) {
	return new Promise((resolve, reject) => {
		exports.textRequestTransformer(text, session_model)
		.then((text) => {

			let request = apiaiClient.textRequest(text, {
				sessionId: session_model.id
			});

			request.on('response', (body) => {
				console.debug(TAG, 'response', body);

				const result = body.result;
				const action = result.action;

				// If this action has not solved using webhook, reparse
				if (result.metadata.webhookUsed === "false") {

					if (result.actionIncomplete !== true && !_.isEmpty(action) && _.isFunction(Actions.list[ action ])) {
						console.info(TAG, 'calling action', action);
						return AI.fulfillmentPromiseTransformer( Actions.list[ action ](), body, session_model )
						.then(resolve)
						.catch(reject);
					}

					AI.fulfillmentTransformer( result.fulfillment, session_model )
					.then(resolve)
					.catch(reject);

				} else {

					let fulfillment = body.result.fulfillment;
					fulfillment.data = fulfillment.data || {};

					// Edit msg from API.AI to reflect IO interface
					if (!_.isEmpty(body.result.fulfillment.messages)) {
						let msg = body.result.fulfillment.messages.getRandom();
						switch (msg.type) {
							case 0:
							break;
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

					resolve(fulfillment);

				}
			});

			request.on('error', (err) => {
				console.error(TAG, 'error', err);
				reject(err);
			});

			request.end();
		});
	});
};