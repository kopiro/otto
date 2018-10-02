const TAG = 'AI';

const _ = require('underscore');
const deepExtend = require('deep-extend');
const Translator = apprequire('translator');
const Messages = apprequire('messages');
const Server = apprequire('server');

const _config = config.apiai;

const apiai = require('apiai');
const client = apiai(_config.token);

function getEntities(session) {
	let entities = [];
	if (config.chromecast.devices) {
		entities = entities.concat([{
			name: "chromecast",
			entries: _.map(config.chromecast.devices, ((value, key) => {
				return { 
					value: key,
					synonyms: [ value.name ]
				};
			}))
		}]);
	}
	return entities;
}

function fulfillmentSanitizer(fulfillment) {
	// Always ensure that is an object
	if (fulfillment == null) {
		console.error('Fulfillment is null or undefined!');
		fulfillment = {};
	}
	// Even if is a string
	if (_.isString(fulfillment)) {
		fulfillment = {
			speech: fulfillment
		};
	}
	fulfillment.data = fulfillment.data || {};
	return fulfillment;
}

/**
 * Transform a fulfillment by making some edits based on the current session settings
 * @param  {Object} fulfillment Fulfillment object
 * @param  {Object} session     Session
 * @return {Object}
 */
async function fulfillmentTransformer(fulfillment, session) {
	fulfillment = fulfillmentSanitizer(fulfillment);

	// Here, merge data with payload in case 
	// fulfillment is direct without an action resolution
	_.defaults(fulfillment.data, fulfillment.payload);
	fulfillment.localTransform = true;

	if (!_.isEmpty(fulfillment.speech)) {
		fulfillment.speech = await Translator.translate(fulfillment.speech, session.getTranslateTo());
	}

	if (fulfillment.data != null && fulfillment.data.error != null) {
		if (!_.isEmpty(fulfillment.data.error.speech)) {
			fulfillment.data.error.speech = await Translator.translate(fulfillment.data.error.speech, session.getTranslateTo());
		}
	}

	return fulfillment;
}

exports.fulfillmentTransformer = fulfillmentTransformer;

async function fulfillmentFromBody(body, session) {
	return new Promise(async(resolve) => {
		let fulfillment = null;
		
		// Start a timeout to ensure that the promise
		// will be anyway triggered, also with an error
		let action_timeout = setTimeout(() => {
			fulfillment = fulfillmentTransformer({
				data: { error: { timeout: true } }
			}, session);
			resolve(fulfillment);
		}, 1000 * (_config.promiseTimeout || 10));

		try {
			console.info(TAG, `calling action ${body.result.action}`);
			// Actual call to the Action
			fulfillment = await Actions.list[ body.result.action ]()(body, session);
		} catch (err) {
			if (err.fulfillment) {
				// Here is a bit of an hack to intercept a fulfillment that is into an error,
				// maybe thrown from an actions_helper
				fulfillment = err.fulfillment;
			} else {
				// instead, if only a simple error is thrown, 
				// just wrap into a standard structure
				fulfillment = { data: { error: err } };
			}
		}

		// Pass the fulfillment to the transformer in final instance
		fulfillment = await fulfillmentTransformer(fulfillment, session);

		clearTimeout(action_timeout);
		resolve(fulfillment);
	});
}

exports.fulfillmentFromBody = fulfillmentFromBody;

exports.textRequestTransformer = async function(text, session) {
	text = text.replace(config.aiNameRegex, ''); // Remove the AI name in the text
	text = await Translator.translate(text, config.language, session.getTranslateTo());
	return text;
};

exports.apiaiResultParser = async function(body, session) {
	// Parse messages
	let f = { payload: {} };
	for (let m of (body.result.fulfillment.messages || [])) {
		delete m.type;
		deepExtend(f, m);
	}
	if (f.payload.__random__) f.payload = rand(f.payload.__random__);
	body.result.fulfillment = f;

	console.info(TAG, 'apiaiResultParser');
	console.dir(f, { depth: 10 });

	if (body.result.metadata.intentId != null) {
		// If an intentId is returned, could auto resolve or call a promise
		if (_.isEmpty(body.result.action) === false && body.result.actionIncomplete !== true) {
			body.result.fulfillment = await fulfillmentFromBody(body, session);
		} else {
			body.result.fulfillment = await fulfillmentTransformer(body.result.fulfillment, session);
		}
		return body.result.fulfillment;
	}

	// If not intentId is returned, this is a unhandled DialogFlow intent
	// So return an error with this speech (ai_unhandled)
	return exports.eventRequest('ai_unhandled', session);
};

exports.textRequest = function(text, session) {
	return new Promise(async(resolve, reject) => {
		console.info(TAG, 'text request =======>', text);

		text = await exports.textRequestTransformer(text, session);
		let request = client.textRequest(text, {
			sessionId: session._id,
			entities: getEntities(session)
		});

		request.on('response', async(body) => {
			console.info(TAG, 'response');
			console.dir(body, { depth: 10 });
			
			let fulfillment;

			if (body.result.metadata.webhookUsed === 'true' && body.status.errorType !== 'partial_content') {
				delete body.result.fulfillment.messages;
				fulfillment = fulfillmentSanitizer(body.result.fulfillment);
				return resolve(fulfillment);
			}
	
			console.debug(TAG, 'webhook not used or failed, solving locally');
			fulfillment = await exports.apiaiResultParser(body, session);
			resolve(fulfillment);
		});

		request.on('error', (err) => {
			console.error(TAG, 'error', err);
			reject(err);
		});

		request.end();
	});
};

exports.eventRequest = function(event, session) {
	return new Promise(async(resolve, reject) => {
		console.info(TAG, 'event request =======>');
		console.dir(event, { depth: 10 });

		if (_.isString(event)) {
			event = { name: event };
		}

		let request = client.eventRequest(event, {
			sessionId: session._id,
			entities: getEntities(session)
		});

		request.on('response', async(body) => {
			console.info(TAG, 'response');
			console.dir(body, { depth: 10 });

			if (body.result.metadata.webhookUsed === 'true' && body.status.errorType !== 'partial_content') {
				delete body.result.fulfillment.messages;
				return resolve(body.result.fulfillment);
			}
	
			console.debug(TAG, 'webhook not used or failed, solving locally');
			let fulfillment = await exports.apiaiResultParser(body, session);
			resolve(fulfillment);
		});

		request.on('error', (err) => {
			console.error(TAG, 'error', err);
			reject(err);
		});

		request.end();
	});
};

exports.attachToServer = function() {
	Server.routerApi.get('/fulfillment', async(req, res) => {
		res.json({ 
			error: { 
				message: 'You should call in POST' 
			} 
		});
	});

	Server.routerApi.post('/fulfillment', async(req, res) => {
		if (req.body == null) {
			console.error(TAG, 'empty body');
			return res.json({ 
				data: { 
					error: 'Empty body' 
				} 
			});
		}
	
		console.info(TAG, 'request');
		console.dir(req.body, { depth: 10 });
	
		const body = req.body;
		const sessionId = body.sessionId;
	
		// From AWH can came any session ID, so ensure it exists on our DB
		let session = await IOManager.getSession(sessionId);
		if (session == null) {
			console.error(TAG, `creating a missing session ID with ${sessionId}`);
			session = new Data.Session({ _id: sessionId });
			session.save();
		}
	
		try {
			
			let fulfillment = await AI.apiaiResultParser(body, session);
			fulfillment.data.remoteTransform = true;
			
			console.info(TAG, 'output fulfillment');
			console.dir(fulfillment, { depth: 3 });
	
			res.json(fulfillment);
		
		} catch (ex) {
			console.info(TAG, 'error', ex);
			res.json({ data: { error: ex } });
		}
	});
}