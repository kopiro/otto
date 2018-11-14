const TAG = 'AI';

const _ = require('underscore');
const Server = apprequire('server');
const Translator = apprequire('translator');

const _config = config.dialogflow;
const dialogflow = require('dialogflow').v2beta1;

const dfSessionClient = new dialogflow.SessionsClient();
const dfContextsClient = new dialogflow.ContextsClient();

function parseContext(c, sessionId) {
	if (!/projects/.test(c.name)) {
		c.name = dfContextsClient.contextPath(_config.projectId, sessionId, c.name);
	}
	return c;
}

/**
 * Clean fulfillment to be suitable for webhook
 * @param {Object} fulfillment
 * @returns
 */
function cleanFulfillmentForWebhook(fulfillment, session) {
	if (fulfillment.outputContexts) {
		fulfillment.outputContexts = fulfillment.outputContexts.map(c =>
			parseContext(c, session.id)
		);
	}
	return fulfillment;
}

/**
 * Get the session path suitable for DialogFlow
 * @param {String} sessionId
 * @returns
 */
function getDFSessionPath(sessionId) {
	if (_config.environment == null) {
		return dfSessionClient.sessionPath(_config.projectId, sessionId);
	} else {
		return dfSessionClient.environmentSessionPath(
			_config.projectId,
			_config.environment,
			'-',
			sessionId
		);
	}
}

/**
 * Set DialogFlow Context
 *
 * @param {*} sessionId
 */
function setDFContext(sessionId, context) {
	context = parseContext(context, sessionId);
	return dfContextsClient.createContext({
		parent: getDFSessionPath(sessionId),
		context: context
	});
}

/**
 * Transform an error into a fulfillment
 * @param {Object} body
 * @param {Error} err
 * @returns
 */
function actionErrorTransformer(body, err) {
	let fulfillment = {};

	if (typeof err === 'string') {
		// If an error occurs, try to intercept this error
		// in the fulfillmentMessages that comes from DialogFlow
		fulfillment.fulfillmentText =
			extractWithPattern(
				body.queryResult.fulfillmentMessages,
				`[].payload.errors.${err}`
			) ||
			extractWithPattern(
				body.queryResult.fulfillmentMessages,
				`[].payload.error.${err}`
			) ||
			err;
	} else if (err.message) {
		// Only used for debugging purposes, TODO remove
		fulfillment.fulfillmentText = 'ERROR: ' + err.message;
	}

	// Add anyway the complete error
	fulfillment.payload = { error: err };

	return fulfillment;
}

/**
 * Transform the result of an action to a fulfillment.
 * It merges the input body with the action result
 * @param {Object} body
 * @param {Object} actionResult
 * @param {Object} session
 * @param {Boolean} fromWebhook
 * @returns
 */
async function actionResultToFulfillment(
	body,
	actionResult,
	session,
	fromWebhook = false
) {
	let fulfillment = null;

	// If an action return a string, wrap into an object
	if (_.isString(actionResult)) {
		actionResult = {
			fulfillmentText: actionResult
		};
	}

	fulfillment = actionResult;

	// Set context if not coming from webhooks
	if (fromWebhook === false) {
		if (fulfillment.outputContexts != null) {
			for (let c of fulfillment.outputContexts) {
				console.info(
					TAG,
					'Setting context manually because we are not in a webhook',
					session.id,
					c
				);
				await setDFContext(session.id, c);
			}
		}
	}

	return fulfillment;
}

/**
 * Accept a Generation action and resolve all outputs
 * @param {Object} body
 * @param {AsyncGenerator} generator
 * @param {Session} session
 */
async function generatorResolver(body, generator, session) {
	console.info(TAG, 'Using generator resolver');
	try {
		for await (let fulfillment of generator) {
			fulfillment = await actionResultToFulfillment(
				body,
				fulfillment,
				session,
				false
			);
			await IOManager.output(fulfillment, session);
		}
	} catch (err) {
		console.error(TAG, 'error while executing action generator', err);
		let fulfillment = actionErrorTransformer(body, err);
		await IOManager.output(fulfillment, session);
	}
}

/**
 * Transform a body from DialogFlow into a Fulfillment by calling the internal action
 * @param {Object} body Payload from DialogFlow
 * @param {*} session  Session
 */
async function actionResolver(body, session, fromWebhook = false) {
	const actionName = body.queryResult.action;
	console.info(TAG, `calling action <${actionName}>`);

	let fulfillment = null;

	try {
		// Actual call to the Action
		const actionToCall = Actions.list[actionName];
		if (actionToCall == null) {
			throw new Error(`Invalid action name: ${actionName}`);
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

		fulfillment = await actionResultToFulfillment(
			body,
			fulfillment,
			session,
			fromWebhook
		);
	} catch (err) {
		console.error(TAG, 'error while executing action:', err);
		fulfillment = await actionErrorTransformer(body, err);
	}

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

		// console.error('Body :', JSON.stringify(body, null, 10));

		// When coming from webhook, unwrap everything
		body.queryResult.parameters = structProtoToJson(
			body.queryResult.parameters
		);
		if (body.queryResult.webhookPayload != null) {
			body.queryResult.payload = structProtoToJson(
				body.queryResult.webhookPayload
			);
			delete body.queryResult.webhookPayload;
		}
		body.queryResult.payload = body.queryResult.payload || {};

		return body.queryResult;
	}

	// If an intent is returned, could auto resolve or call a promise
	if (fromWebhook === false) {
		// When coming NOT from webhook,
		// parameters, fulfillmentMessages and payload are wrapped
		// in a very complicated STRUCT_PROTO
		// that is pretty unusable, so we just un-wrap
		body.queryResult.parameters = structProtoToJson(
			body.queryResult.parameters
		);
		body.queryResult.fulfillmentMessages = body.queryResult.fulfillmentMessages.map(
			e => {
				return {
					payload: structProtoToJson(e.payload)
				};
			}
		);
		body.queryResult.payload = structProtoToJson(body.queryResult.payload);

		console.warn(
			TAG,
			'Parsing body locally, this could be intentional, but check your intent'
		);
	}

	if (body.queryResult.action) {
		console.info(TAG, 'Using action resolver');
		return await actionResolver(body, session, fromWebhook);
	}

	// Otherwise, check if at least an intent is match and direct return that fulfillment
	if (body.queryResult.intent) {
		console.info(TAG, 'Using queryResult');
		return {
			fulfillmentText: body.queryResult.fulfillmentText,
			outputContexts: body.queryResult.outputContexts,
			payload: body.queryResult.payload
		};
	}

	// If not intentId is returned, this is a unhandled DialogFlow intent
	// So make another event request to inform user (ai_unhandled)
	console.info(TAG, 'Using ai_unhandled followupEventInput');
	return {
		followupEventInput: {
			name: 'ai_unhandled',
			languageCode: session.getTranslateTo()
		}
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
		session: getDFSessionPath(session.id),
		queryInput: {
			text: {
				text: text,
				languageCode: session.getTranslateFrom()
			}
		}
	});
	return bodyParser(responses[0], session);
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

	// Instantiate the DialogFlow request
	const responses = await dfSessionClient.detectIntent({
		session: getDFSessionPath(session.id),
		queryInput: {
			event: {
				name: event,
				languageCode: session.getTranslateFrom()
			}
		}
	});
	return bodyParser(responses[0], session);
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

		let fulfillment = await bodyParser(req.body, session, true);
		fulfillment = await IOManager.fulfillmentTransformer(fulfillment, session);
		fulfillment = cleanFulfillmentForWebhook(fulfillment, session);

		console.info(TAG, '[WEBHOOK] output fulfillment');
		console.log(JSON.stringify(fulfillment));

		res.json(fulfillment);
	});
};

exports.textRequest = textRequest;
exports.eventRequest = eventRequest;
