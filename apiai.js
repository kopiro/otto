const TAG = 'API.AI';

const apiaiClient = require('apiai')(config.APIAI_TOKEN);

const AI_NAME_REGEX = /^(?:Otto(,\s*)?)|(\s*Otto)$/i;
const Actions = require(__basedir + '/actions');

exports.fulfillmentTransformer = function(f, session_model) {
	return new Promise((resolve, reject) => {

		// Ensure always data object exists
		f.data = f.data || {};

		if (session_model.get('translate_to')) {
			if (!_.isEmpty(f.speech)) {
				apprequire('translator').translate(f.speech, session_model.get('translate_to'), (err, new_speech) => {
					if (err) return resolve(f);
					f.speech = new_speech;					
					resolve(f);
				});
			} else {
				resolve(f);
			}
		} else {
			resolve(f);
		}
	});
};

exports.fulfillmentPromiseTransformer = function(fn, data, session_model) {
	return new Promise((resolve, reject) => {
		fn(data, session_model)
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
				const action = body.result.action;

				// Edit msg from API.AI to reflect IO interface
				if (!_.isEmpty(body.result.fulfillment.messages)) {
					let msg = body.result.fulfillment.messages.getRandom();
					switch (msg.type) {
						case 0:
						break;
						case 2:
						body.result.fulfillment.data.replies = msg.replies;
						break;
						case 3:
						body.result.fulfillment.data = { image: { remoteFile: msg.imageUrl } };
						break;
						case 4:
						body.result.fulfillment.data = msg.payload;
						break;
						default:
						console.error(TAG, 'Type not recognized');
						break;
					}
					delete body.result.fulfillment.messages;
				}

				body.result.fulfillment.data = body.result.fulfillment.data || {};

				console.debug(TAG, 'response', body);

				// If this action has not solved using webhook, reparse
				if (body.result.metadata.webhookUsed === "false") {

					if (body.result.actionIncomplete !== true && !_.isEmpty(action) && _.isFunction(Actions.list[ action ])) {
						console.info(TAG, 'calling action', action);
						return AI.fulfillmentPromiseTransformer( Actions.list[ action ](), body, session_model )
						.then(resolve)
						.catch(reject);
					}

					console.info(TAG, 'local resolution');

					return AI.fulfillmentTransformer( body.result.fulfillment, session_model )
					.then(resolve)
					.catch(reject);

				}

				resolve(body.result.fulfillment);
			});

			request.on('error', (err) => {
				console.error(TAG, 'error', err);
				reject(err);
			});

			request.end();
		});
	});
};