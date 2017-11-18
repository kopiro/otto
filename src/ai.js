const TAG = 'AI';

const _ = require('underscore');

const _config = config.apiai;

const apiaiClient = require('apiai')(_config.token);

const Translator = apprequire('translator');

exports.fulfillmentTransformer = async function(f, session_model, callback) {
	// Ensure always data object exists
	f = f || {};
	f.data = f.data || {};

	if (session_model.translate_to && session_model.translate_to != config.language) {
		const language = session_model.translate_to;

		if (!_.isEmpty(f.speech)) {
			try {
				f.speech = await Translator.translate(f.speech, language);
			} catch (err) {}
		} else if (f.data.error && !_.isEmpty(f.data.error.speech)) {
			try {
				f.data.error.speech = Translator.translate(f.data.error.speech, language);
			} catch (err) {}
		}
	}

	callback(f);
};

exports.fulfillmentPromiseTransformer = async function(fn, data, session_model, callback) {
	if (!_.isFunction(fn)) {
		return exports.fulfillmentTransformer({
			data: { error: "Not a function" }
		}, session_model, callback);
	}

	// Start a timeout to ensure that the promise
	// will be anyway triggered, also with an error
	let promise_timeout = setTimeout(() => {
		exports.fulfillmentTransformer({
			data: { error: { timeout: true } }
		}, session_model, callback);
	}, 1000 * (_config.promiseTimeout || 10));

	try {
		const fulfillment = await fn(data, session_model);
		clearTimeout(promise_timeout);
		exports.fulfillmentTransformer(fulfillment || {}, session_model, callback);
	} catch (err) {
		exports.fulfillmentTransformer({
			data: { error: err }
		}, session_model, callback);
	}
};

exports.textRequestTransformer = async function(text, session_model, callback) {
	text = text.replace(AI_NAME_ACTIVATOR, ''); // Remove the AI name in the text

	if (session_model.translate_from && session_model.translate_from != config.language) {
		try {
			text = await Translator.translate(text, 'it');
		} catch (err) {}
	}

	callback(text);
};

exports.textRequest = function(text, session_model) {
	return new Promise((resolve, reject) => {

		exports.textRequestTransformer(text, session_model, (text) => {

			let request = apiaiClient.textRequest(text, {
				sessionId: session_model._id
			});

			console.debug(TAG, 'request', { text });

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

				console.info(TAG, 'response', body);

				if (body.result.metadata.webhookUsed === "true") {
					if (body.status.errorType === 'partial_content') {
						console.warn(TAG, 'webhook failed, solving locally');
					} else {
						return resolve(body.result.fulfillment);
					}
				}

				// If this action has not solved using webhook, reparse
				if (body.result.actionIncomplete !== true && !_.isEmpty(action)) {
					console.warn(TAG, 'calling local action', action);
					const action_fn = Actions.list[ action ];
					if (action_fn == null) {
						return reject();
					}
			
					AI.fulfillmentPromiseTransformer(action_fn(), body, session_model, resolve);
			
				} else {
					console.warn(TAG, 'local resolution');
					AI.fulfillmentTransformer(body.result.fulfillment, session_model, resolve);
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