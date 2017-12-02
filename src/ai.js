const TAG = 'AI';

const _ = require('underscore');
const Translator = apprequire('translator');
const Messages = apprequire('messages');

const _config = _.defaults(config.apiai, {
	promiseTimeout: 10
});

const apiai = require('apiai');
const client = apiai(_config.token);

async function fulfillmentTransformer(fulfillment, session_model) {
	// Ensure always data object exists
	if (!_.isObject(fulfillment)) {
		throw new Error('Fulfillment is not an object');
	}

	fulfillment = _.defaults(fulfillment, {
		data: {}
	});

	if (!_.isEmpty(fulfillment.speech)) {
		fulfillment.speech = await Translator.translate(fulfillment.speech, session_model.getTranslateTo());
	}

	if (fulfillment.data.error != null) {
		if (!_.isEmpty(fulfillment.data.error.speech)) {
			fulfillment.data.error.speech = await Translator.translate(fulfillment.data.error.speech, session_model.getTranslateTo());
		}
	}

	return fulfillment;
}

exports.fulfillmentTransformer = fulfillmentTransformer;

async function fulfillmentPromiseTransformer(execute_fn, data, session_model) {
	return new Promise(async(resolve) => {
		let fulfillment = null;
		
		// Start a timeout to ensure that the promise
		// will be anyway triggered, also with an error
		let action_timeout = setTimeout(() => {
			fulfillment = fulfillmentTransformer({
				data: { error: { timeout: true } }
			}, session_model);
			resolve(fulfillment);
		}, 1000 * _config.promiseTimeout);

		try {
			fulfillment = await execute_fn(data, session_model);
			fulfillment = await fulfillmentTransformer(fulfillment, session_model);
		} catch (err) {
			fulfillment = await fulfillmentTransformer({
				data: { error: err }
			}, session_model);
		}

		clearTimeout(action_timeout);
		resolve(fulfillment);
	});
}

exports.fulfillmentPromiseTransformer = fulfillmentPromiseTransformer;

exports.textRequestTransformer = async function(text, session_model) {
	text = text.replace(config.aiNameRegex, ''); // Remove the AI name in the text
	text = await Translator.translate(text, config.language, session_model.getTranslateTo());
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
			console.error(TAG, 'type not recognized');
			break;
		}
		delete body.result.fulfillment.messages;
	}

	body.result.fulfillment.data = body.result.fulfillment.data || {};
	return body;
}

exports.apiaiResultParser = async function(body, session_model) {
	const res = body.result;

	let fulfillment = null;
	if (res.metadata.intentId != null) {
		if (_.isEmpty(res.action) === false && res.actionIncomplete !== true) {
			const action_fn = Actions.list[ res.action ];
			console.info(TAG, 'calling action', res.action);
			fulfillment = await fulfillmentPromiseTransformer(action_fn(), body, session_model);
		} else {
			fulfillment = await fulfillmentTransformer(res.fulfillment, session_model);
		}
	} else {
		fulfillment = await fulfillmentTransformer({
			error: {
				speech: Messages.get('ai_unhandled')
			}
		}, session_model);
	}

	return fulfillment;
};

exports.textRequest = function(text, session_model) {
	return new Promise(async(resolve, reject) => {
		console.debug(TAG, 'request', text);

		text = await exports.textRequestTransformer(text, session_model);
		let request = client.textRequest(text, {
			sessionId: session_model._id
		});

		request.on('response', async(body) => {
			body = apiaiInterfaceConverter(body);
			console.info(TAG, 'response');
			console.dir(body, { depth: 10 });

			if (body.result.metadata.webhookUsed === 'true' && body.status.errorType !== 'partial_content') {
				return resolve(body.result.fulfillment);
			}
	
			console.info(TAG, 'webhook not used or failed, solving locally');
			let fulfillment = await exports.apiaiResultParser(body, session_model);
			resolve(fulfillment);
		});

		request.on('error', (err) => {
			console.error(TAG, 'error', err);
			reject(err);
		});

		request.end();
	});
};