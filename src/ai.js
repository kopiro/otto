const TAG = 'AI';

const _ = require('underscore');
const deepExtend = require('deep-extend');
const Translator = apprequire('translator');
const Messages = apprequire('messages');

const _config = config.apiai;

const apiai = require('apiai');
const client = apiai(_config.token);

async function fulfillmentTransformer(fulfillment, session_model) {
	// Ensure always data object exists
	if (!_.isObject(fulfillment)) {
		throw new Error('Fulfillment is not an object');
	}

	_.defaults(fulfillment, {
		data: {},
		payload: {}
	});
	
	fulfillment.localTransform = true;

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

async function fulfillmentPromiseTransformer(action, body, session_model) {
	return new Promise(async(resolve) => {
		let fulfillment = null;
		
		// Start a timeout to ensure that the promise
		// will be anyway triggered, also with an error
		let action_timeout = setTimeout(() => {
			fulfillment = fulfillmentTransformer({
				data: { error: { timeout: true } }
			}, session_model);
			resolve(fulfillment);
		}, 1000 * (_config.promiseTimeout || 10));

		try {
			console.debug(TAG, `calling action ${action}`);
			fulfillment = await Actions.list[ body.result.action ]()(body, session_model);
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

exports.textRequestTransformer = async function(text, session_model) {
	text = text.replace(config.aiNameRegex, ''); // Remove the AI name in the text
	text = await Translator.translate(text, config.language, session_model.getTranslateTo());
	return text;
};


exports.apiaiResultParser = async function(body, session_model) {
	// Parse messages
	let f = { 
		data: {},
		payload: {}
	};
	(body.result.fulfillment.messages || []).forEach((m) => {
		delete m.type;
		deepExtend(f, m);
	});
	body.result.fulfillment = f;

	console.info(TAG, 'fulfillment');
	console.dir(f, { depth: 10 });

	if (body.result.metadata.intentId != null) {
		// If an intentId is returned, could auto resolve or call a promise
		if (_.isEmpty(body.result.action) === false && body.result.actionIncomplete !== true) {
			body.result.fulfillment = await fulfillmentPromiseTransformer(body.result.action, body, session_model);
		} else {
			body.result.fulfillment = await fulfillmentTransformer(body.result.fulfillment, session_model);
		}
		return body.result.fulfillment;
	}

	// If not intentId is returned, this is a unhandled DialogFlow intent
	// So return an error with this speech (ai_unhandled)
	return exports.eventRequest('ai_unhandled', session_model);
};

exports.textRequest = function(text, session_model) {
	return new Promise(async(resolve, reject) => {
		console.debug(TAG, 'text request =======>', text);

		text = await exports.textRequestTransformer(text, session_model);
		let request = client.textRequest(text, {
			sessionId: session_model._id
		});

		request.on('response', async(body) => {
			console.info(TAG, 'response');
			console.dir(body, { depth: 10 });

			if (body.result.metadata.webhookUsed === 'true' && body.status.errorType !== 'partial_content') {
				delete body.result.fulfillment.messages;
				return resolve(body.result.fulfillment);
			}
	
			console.debug(TAG, 'webhook not used or failed, solving locally');
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

exports.eventRequest = function(event, session_model) {
	return new Promise(async(resolve, reject) => {
		console.debug(TAG, 'event request =======>', event);

		if (_.isString(event)) {
			event = { name: event };
		}

		let request = client.eventRequest(event, {
			sessionId: session_model._id
		});

		request.on('response', async(body) => {
			console.info(TAG, 'response');
			console.dir(body, { depth: 10 });

			if (body.result.metadata.webhookUsed === 'true' && body.status.errorType !== 'partial_content') {
				delete body.result.fulfillment.messages;
				return resolve(body.result.fulfillment);
			}
	
			console.debug(TAG, 'webhook not used or failed, solving locally');
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