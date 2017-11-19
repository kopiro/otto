const TAG = 'AI';

const _ = require('underscore');

const _config = config.apiai;

const apiaiClient = require('apiai')(_config.token);

const Translator = apprequire('translator');

exports.fulfillmentTransformer = async function(fulfillment, session_model) {
	// Ensure always data object exists
	if (!_.isObject(fulfillment)) {
		throw 'Fulfillment is not an object';
	}

	fulfillment.data = fulfillment.data || {};

	console.debug(TAG, 'fulfillment transformer', { fulfillment });

	if (!_.isEmpty(fulfillment.speech)) {
		try {
			fulfillment.speech = await Translator.translate(fulfillment.speech, session_model.getTranslateTo());
		} catch (ex) {}
	}

	if (fulfillment.data.error != null && !_.isEmpty(fulfillment.data.error.speech)) {
		try {
			fulfillment.data.error.speech = Translator.translate(fulfillment.data.error.speech, session_model.getTranslateTo());
		} catch (ex) {}
	}

	return fulfillment;
};

exports.fulfillmentPromiseTransformer = async function(fn, data, session_model) {
	return new Promise(async(resolve) => {
		let fulfillment;
		
		// Start a timeout to ensure that the promise
		// will be anyway triggered, also with an error
		let action_timeout = setTimeout(() => {
			fulfillment = exports.fulfillmentTransformer({
				data: { error: { timeout: true } }
			}, session_model);
			resolve(fulfillment);
		}, 1000 * (_config.promiseTimeout || 10));

		try {
			fulfillment = await fn(data, session_model);
			fulfillment = await exports.fulfillmentTransformer(fulfillment, session_model);
		} catch (err) {
			fulfillment = await exports.fulfillmentTransformer({
				data: { error: err }
			}, session_model);
		}

		clearTimeout(action_timeout);
		resolve(fulfillment);
	});
};

exports.textRequestTransformer = async function(text, session_model) {
	text = text.replace(AI_NAME_ACTIVATOR, ''); // Remove the AI name in the text
	text = await Translator.translate(text, 'it', session_model.getTranslateTo());
	return text;
};

function apiaiInterfaceConverter(body) {
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
	return body;
}

exports.textRequest = function(text, session_model) {
	return new Promise(async(resolve, reject) => {
		console.debug(TAG, 'request', { text });

		text = await exports.textRequestTransformer(text, session_model);
		let request = apiaiClient.textRequest(text, {
			sessionId: session_model._id
		});

		request.on('response', async(body) => {
			body = apiaiInterfaceConverter(body);
			console.info(TAG, 'response', JSON.stringify(body, null, 2));

			const action = body.result.action;

			if (body.result.metadata.webhookUsed === 'true' && body.status.errorType !== 'partial_content') {
				return resolve(body.result.fulfillment);
			}
	
			console.warn(TAG, 'webhook not used or failed, solving locally');
	
			let fulfillment = null;
			if (body.result.actionIncomplete !== true && !_.isEmpty(action)) {
				const action_fn = Actions.list[ action ];
				console.warn(TAG, 'calling action', action);
				fulfillment = await AI.fulfillmentPromiseTransformer(action_fn(), body, session_model);
			} else {
				fulfillment = await AI.fulfillmentTransformer(body.result.fulfillment, session_model);
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