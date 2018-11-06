const TAG = "AI";

const _ = require("underscore");
const deepExtend = require("deep-extend");
const Translator = apprequire("translator");
const Server = apprequire("server");

const _config = config.apiai;

const client = require("apiai")(_config.token);

// TODO: remember what this shit does
function getEntities(session) {
	let entities = [];
	entities = entities.concat([{
		name: "chromecast",
		entries: _.map(session.settings.chromecasts || [], (value, key) => {
			return {
				value: key,
				synonyms: [value.name]
			};
		})
	}]);
	return entities;
}

/**
 * Sanitize a fulfillment by ensuring that it could be sent to a parser without errors
 * @param {Object} fulfillment
 */
function fulfillmentSanitizer(fulfillment) {
	if (fulfillment == null) return null;

	// Even if is a string
	if (_.isString(fulfillment)) {
		fulfillment = {
			speech: fulfillment
		};
	}
	// Ensure .data
	fulfillment.data = fulfillment.data || {};
	return fulfillment;
}

/**
 * Transform a Fulfillment by making some edits based on the current session settings
 * @param  {Object} fulfillment Fulfillment object
 * @param  {Object} session Session
 * @return {Object}
 */
async function fulfillmentTransformer(fulfillment, session) {
	if (fulfillment == null) return null;

	fulfillment = fulfillmentSanitizer(fulfillment);

	// Here, merge data with payload in case
	// fulfillment is direct without an action resolution
	_.defaults(fulfillment.data, fulfillment.payload);
	fulfillment.localTransform = true;

	// Always translate fulfillment speech in the user language
	if (!_.isEmpty(fulfillment.speech)) {
		fulfillment.speech = await Translator.translate(
			fulfillment.speech,
			session.getTranslateTo()
		);
	}

	// Always translate fulfillment error in the user language
	if (fulfillment.data != null && fulfillment.data.error != null) {
		if (!_.isEmpty(fulfillment.data.error.speech)) {
			fulfillment.data.error.speech = await Translator.translate(
				fulfillment.data.error.speech,
				session.getTranslateTo()
			);
		}
	}

	return fulfillment;
}

/**
 * Transform a body from DialogFlow into a Fulfillment by calling the internal action
 * @param {Object} body Payload from DialogFlow
 * @param {*} session  Session
 */
async function fulfillmentFromBody(body, session) {
	return new Promise(async resolve => {
		let fulfillment = null;

		// Start a timeout to ensure that the promise
		// will be anyway triggered, also with an error
		let action_timeout = setTimeout(async () => {
			resolve(
				await fulfillmentTransformer({
						data: {
							error: {
								timeout: true
							}
						}
					},
					session
				)
			);
		}, 1000 * _config.actionTimeout);

		try {
			console.info(TAG, `calling action ${body.result.action}`);

			// Actual call to the Action
			const foo = Actions.list[body.result.action];
			if (foo == null) {
				throw new Error("Invalid action name");
			}

			fulfillment = await foo()(body, session);
		} catch (err) {
			if (err.fulfillment) {
				// Here is a bit of an hack to intercept a fulfillment that is into an error,
				// maybe thrown from an actions_helper
				fulfillment = err.fulfillment;
			} else {
				// instead, if only a simple error is thrown,
				// just wrap into a standard structure
				fulfillment = {
					data: {
						error: err
					}
				};
			}
		}

		clearTimeout(action_timeout);

		// Pass the fulfillment to the transformer in final instance
		resolve(await fulfillmentTransformer(fulfillment, session));
	});
}

/**
 * Transform a text request to make it compatible and translating it
 * @param {String} text Sentemce
 * @param {Object} session Session
 */
async function textRequestTransformer(text, session) {
	text = text.replace(config.aiNameRegex, ""); // Remove the AI name in the text
	text = await Translator.translate(
		text,
		config.language,
		session.getTranslateTo()
	);
	return text;
}

/**
 * Transform an event by making compatible
 * @param {Object} event Event string or object
 * @param {Object} session Session
 */
async function eventRequestTransformer(event, session) {
	if (_.isString(event)) {
		event = {
			name: event
		};
	}
	return event;
}

/**
 * Parse the Dialogflow body and decide what to do
 * @param {Object} body Payload
 * @param {Object} session Session
 */
async function bodyParser(body, session) {
	let f = {
		payload: {}
	};

	// Parse messages of the body and deep extend every message in the fulfillment
	for (let m of body.result.fulfillment.messages || []) {
		delete m.type;
		deepExtend(f, m);
	}

	// If payload contains __random__, pick one of this array
	if (f.payload.__random__) f.payload = rand(f.payload.__random__);

	// Assign to body
	body.result.fulfillment = f;

	// If an intentId is returned, could auto resolve or call a promise
	if (body.result.metadata.intentId != null) {
		if (
			_.isEmpty(body.result.action) === false &&
			body.result.actionIncomplete !== true
		) {
			// If the action is incomplete, call the action resolver
			// that will also transform the fulfillment
			body.result.fulfillment = await fulfillmentFromBody(body, session);
		} else {
			// Otherwise, just transform the fulfillment
			body.result.fulfillment = await fulfillmentTransformer(
				body.result.fulfillment,
				session
			);
		}

		return body.result.fulfillment;
	}

	// If not intentId is returned, this is a unhandled DialogFlow intent
	// So make another event request to inform user (ai_unhandled)
	return await eventRequest("ai_unhandled", session);
}

/**
 * Function to call when Dialogflow respond
 * @param {Object} body Body from DialogFlow
 * @param {Object} session Session
 */
async function onRequestComplete(body, session) {
	console.info(TAG, "response");
	console.dir(body, {
		depth: 3
	});

	let fulfillment = null;

	// If this response is already fullfilld by webhook, do not call action locally but just resolve
	if (
		body.result.metadata.webhookUsed === "true" &&
		body.status.errorType !== "partial_content"
	) {
		delete body.result.fulfillment.messages;
		return fulfillmentSanitizer(body.result.fulfillment);
	}

	// Othwerwise, call the action locally
	console.warn(TAG, "webhook not used or failed, solving locally");
	fulfillment = await bodyParser(body, session);
	return fulfillment;
}

/**
 * Get the arguments for Dialogflow request
 * @param {Object} session Session
 */
function getRequestArgs(session) {
	return {
		sessionId: session._id,
		entities: getEntities(session)
	};
}

/**
 * Make a text request to DialogFlow and let the flow begin
 * @param {String} text Sentence
 * @param {Object} session Session
 */
async function textRequest(text, session) {
	return new Promise(async (resolve, reject) => {
		console.info(TAG, "text request:", text);

		// Transform the text to eventually translate it
		text = await textRequestTransformer(text, session);

		// Instantiate the Dialogflow request
		const request = client.textRequest(text, getRequestArgs(session));
		request.on("response", async body => {
			let r = await onRequestComplete(body, session);
			resolve(r);
		});
		request.on("error", reject);
		request.end();
	});
}

/**
 * Make an event request to Dialogflow and let the flow begin
 * @param {String} event Event name
 * @param {Object} session Session
 */
async function eventRequest(event, session) {
	return new Promise(async (resolve, reject) => {
		console.info(TAG, "event request:", event);

		event = await eventRequestTransformer(event, session);

		// Instantiate the Dialogflow request
		const request = client.eventRequest(event, getRequestArgs(session));
		request.on("response", async body => {
			let r = await onRequestComplete(body, session);
			resolve(r);
		});
		request.on("error", reject);
		request.end();
	});
}

/**
 * Attach the AI to the Server
 */
function attachToServer() {
	Server.routerApi.post("/fulfillment", async (req, res) => {
		if (req.body == null) {
			return res.json({
				data: {
					error: "Empty body"
				}
			});
		}

		console.info(TAG, "webhook request");
		console.dir(req.body, {
			depth: 3
		});

		const body = req.body;
		const sessionId = body.sessionId;

		// From AWH can came any session ID, so ensure it exists on our DB
		let session = await IOManager.getSession(sessionId);
		if (session == null) {
			console.error(TAG, `creating a missing session ID with ${sessionId}`);
			session = new Data.Session({
				_id: sessionId
			});
			session.save();
		}

		try {
			const fulfillment = await bodyParser(body, session);
			fulfillment.data.remoteTransform = true;

			console.info(TAG, "webhook fulfillment");
			console.dir(fulfillment, {
				depth: 3
			});

			res.json(fulfillment);
		} catch (ex) {
			res.json({
				data: {
					error: ex
				}
			});
		}
	});
}

exports.fulfillmentTransformer = fulfillmentTransformer;
exports.fulfillmentFromBody = fulfillmentFromBody;
exports.textRequest = textRequest;
exports.eventRequest = eventRequest;
exports.attachToServer = attachToServer;