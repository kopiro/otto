const TAG = 'AI';

const _ = require('underscore');
const Translator = apprequire('translator');
const Server = apprequire('server');

const _config = config.dialogflow;

const dfSessionClient = new (require('dialogflow')).SessionsClient();

/**
 * Get the session path suitable for DialogFlow
 * @param {String} sessionId
 * @returns
 */
function getDFSessionPath(sessionId) {
	return dfSessionClient.sessionPath(_config.projectId, sessionId);
}

/**
 * Transform a Fulfillment by making some edits based on the current session settings
 * @param  {Object} fulfillment Fulfillment object
 * @param  {Object} session Session
 * @return {Object}
 */
async function fulfillmentTransformer(fulfillment, session) {
	// Always translate fulfillment speech in the user language
	if (fulfillment.fulfillmentText) {
		fulfillment.fulfillmentText = await Translator.translate(
			fulfillment.fulfillmentText,
			session.getTranslateTo()
		);
	}

	return {
		fulfillmentText: fulfillment.fulfillmentText,
		outputContexts: fulfillment.outputContexts,
		payload: fulfillment.payload
	};
}

/**
 * Transform an error into a fulfillment
 * @param {Object} body
 * @param {Error} err
 * @returns
 */
function actionErrorTransformer(body, err) {
	let fulfillment = null;

	// If an error occurs, try to intercept this error
	// in the fulfillmentMessages that comes from DialogFlow
	if (typeof err === 'string') {
		fulfillment = {
			fulfillmentText:
				extractWithPattern(
					body.queryResult.fulfillmentMessages,
					`[].payload.errors.${err}`
				) || err
		};
	} else {
		fulfillment = {
			payload: {
				error: err
			}
		};
	}

	return fulfillment;
}

/**
 * Transform the result of an action to a fulfillment.
 * It merges the input body with the action result
 * @param {Object} body
 * @param {Object} actionResult
 * @returns
 */
function actionTransformer(body, actionResult) {
	if (actionResult == null) {
		return null;
	}

	// If an action return a string, wrap into an object
	if (_.isString(actionResult)) {
		actionResult = {
			fulfillmentText: actionResult
		};
	}

	// Merge input queryResult to actionFulfillment
	// This is useful to preserve outputContexts and payload from DialogFlow intent
	return Object.assign(body.queryResult, actionResult);
}

/**
 * Accept a Generation action and resolve all outputs
 * @param {Object} body
 * @param {AsyncGenerator} generator
 * @param {Session} session
 */
async function generatorResolver(body, generator, session) {
	try {
		for await (let fulfillment of generator) {
			fulfillment = await actionTransformer(body, fulfillment);
			fulfillment = await fulfillmentTransformer(fulfillment, session);
			await IOManager.output(fulfillment, session);
		}
	} catch (err) {
		console.error(TAG, 'error in generator', err);
		let fulfillment = await actionErrorTransformer(body, err);
		fulfillment = await fulfillmentTransformer(fulfillment, session);
		await IOManager.output(fulfillment, session);
	}
}

/**
 * Transform a body from DialogFlow into a Fulfillment by calling the internal action
 * @param {Object} body Payload from DialogFlow
 * @param {*} session  Session
 */
async function actionResolver(body, session) {
	const actionName = body.queryResult.action;
	console.info(TAG, `calling action <${actionName}>`);

	let fulfillment = null;

	try {
		// Actual call to the Action
		const actionToCall = Actions.list[actionName];
		if (actionToCall == null) {
			throw new Error(`Invalid action name: <${actionName}>`);
		}

		fulfillment = await actionToCall()(body, session);

		// Now check if this action is a Promise or a Generator
		if (typeof fulfillment.next === 'function') {
			generatorResolver(body, fulfillment, session);
			return {
				payload: {
					handledByGenerator: true
				}
			};
		}

		fulfillment = await actionTransformer(body, fulfillment);
	} catch (err) {
		console.error(TAG, 'error while executing action:', err);
		fulfillment = await actionErrorTransformer(body, err);
	}

	fulfillment = await fulfillmentTransformer(fulfillment, session);
	return fulfillment;
}

/**
 * Transform a text request to make it compatible and translating it
 * @param {String} text Sentence
 * @param {Object} session Session
 */
async function textRequestTransformer(text, session) {
	// Remove the AI name in the text
	text = text.replace(config.aiNameRegex, '');
	// Translate if needed
	if (config.language != session.getTranslateTo()) {
		text = await Translator.translate(
			text,
			config.language,
			session.getTranslateTo()
		);
	}
	return text;
}

/**
 * Transform an event by making compatible
 * @param {Object} event Event string or object
 * @param {Object} session Session
 */
async function eventRequestTransformer(event, session) {
	return event;
}

/**
 * Parse the DialogFlow body and decide what to do
 * @param {Object} body Payload
 * @param {Object} session Session
 */
async function bodyParser(body, session, fromWebhook = false) {
	if (body.webhookStatus != null) {
		if (body.webhookStatus.code > 0) {
			return {
				error: body.webhookStatus
			};
		}

		return body.queryResult;
	}

	// If an intent is returned, could auto resolve or call a promise
	if (fromWebhook === false) {
		// TODO: We should understand why fulfillmentMessages
		// is different when called by webhook
		console.warn(
			TAG,
			'Parsing body locally, this could be intentional, but check your intent'
		);
	}

	if (body.queryResult.action) {
		console.info(TAG, 'Using action resolver');
		return await actionResolver(body, session);
	}

	// Otherwise, check if at least an intent is match and direct return that fulfillment
	if (body.queryResult.intent) {
		console.info(TAG, 'Using queryResult');
		return await fulfillmentTransformer(body.queryResult, session);
	}

	// If not intentId is returned, this is a unhandled DialogFlow intent
	// So make another event request to inform user (ai_unhandled)
	return {
		followupEventInput: 'ai_unhandled'
	};
}

/**
 * Make a text request to DialogFlow and let the flow begin
 * @param {String} text Sentence
 * @param {Object} session Session
 */
async function textRequest(text, session) {
	console.info(TAG, 'text request:', text);

	// Transform the text to eventually translate it
	text = await textRequestTransformer(text, session);

	// Instantiate the DialogFlow request
	const responses = await dfSessionClient.detectIntent({
		session: getDFSessionPath(session._id),
		queryInput: {
			text: {
				text: text,
				languageCode: session.getTranslateFrom()
			}
		}
	});
	return await bodyParser(responses[0], session);
}

/**
 * Make an event request to DialogFlow and let the flow begin
 * @param {String} text Sentence
 * @param {Object} session Session
 */
async function eventRequest(event, session) {
	console.info(TAG, 'event request:', event);

	// Transform the text to eventually translate it
	event = await eventRequestTransformer(event, session);

	// Instantiate the Dialogflow request
	const responses = await dfSessionClient.detectIntent({
		session: getDFSessionPath(session._id),
		queryInput: {
			event: {
				name: event,
				languageCode: session.getTranslateFrom()
			}
		}
	});
	return await bodyParser(responses[0], session);
}

/**
 * Attach the AI to the Server
 */
exports.attachToServer = function() {
	Server.routerApi.post('/fulfillment', async (req, res) => {
		if (req.body == null) {
			return res.json({
				data: {
					error: 'Empty body'
				}
			});
		}

		console.info(TAG, '[WEBHOOK] received request');
		console.dir(req.body, {
			depth: 10
		});

		const sessionId = req.body.session.split('/').pop();

		// From AWH can came any session ID, so ensure it exists on our DB
		let session = await IOManager.getSession(sessionId);
		if (session == null) {
			console.error(TAG, `creating a missing session ID with ${sessionId}`);
			session = new Data.Session({
				_id: sessionId
			});
			await session.save();
		}

		const fulfillment = await bodyParser(req.body, session, true);
		console.info(TAG, '[WEBHOOK] output fulfillment');
		console.dir(fulfillment, {
			depth: 10
		});

		res.json(fulfillment);
	});
};

exports.fulfillmentTransformer = fulfillmentTransformer;
exports.textRequest = textRequest;
exports.eventRequest = eventRequest;
