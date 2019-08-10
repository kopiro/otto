const DialogFlow = require('dialogflow');
const Server = require('./server');
const IOManager = require('./iomanager');
const Translator = require('../lib/translator');
const Actions = require('../actions/index');
const Data = require('../data/index');
const config = require('../config');
const { structProtoToJson, extractWithPattern } = require('../helpers');

const dialogflow = DialogFlow.v2beta1;
const _config = config.dialogflow;

const dfSessionClient = new dialogflow.SessionsClient();
const dfContextsClient = new dialogflow.ContextsClient();

const TAG = 'AI';

/**
 * Parse the context
 * @param {Object} c Context
 * @param {String} sessionId SessionID
 */
function parseContext(c, sessionId) {
  if (!/projects/.test(c.name)) {
    c.name = dfContextsClient.contextPath(_config.projectId, sessionId, c.name);
  }
  return c;
}

/**
 * Clean fulfillment to be suitable for webhook
 * @param {Object} f Fulfillment
 * @param {Session} session Session
 * @returns
 */
async function fulfillmentTransformerForWebhookOutput(f, session) {
  if (f.outputContexts) {
    f.outputContexts = f.outputContexts.map(c => parseContext(c, session.id));
  }
  return f;
}

/**
 * Get the session path suitable for DialogFlow
 * @param {String} sessionId
 * @returns
 */
function getDFSessionPath(sessionId) {
  const dfSessionId = sessionId.replace(/\//g, '_');
  if (_config.environment == null) {
    return dfSessionClient.sessionPath(_config.projectId, dfSessionId);
  }
  return dfSessionClient.environmentSessionPath(
    _config.projectId,
    _config.environment,
    '-',
    dfSessionId
  );
}

/**
 * Set DialogFlow Context
 *
 * @param {*} sessionId
 */
function setDFContext(sessionId, context) {
  return dfContextsClient.createContext({
    parent: getDFSessionPath(sessionId),
    context: parseContext(context, sessionId)
  });
}

/**
 * Transform an error into a fulfillment
 * @param {Object} body
 * @param {Error} err
 * @returns
 */
function actionErrorTransformer(body, err) {
  const f = {};

  if (err.message) {
    const errMessage = typeof err === 'string' ? err : err.message;

    // If an error occurs, try to intercept this error
    // in the fulfillmentMessages that comes from DialogFlow
    f.fulfillmentText =
      extractWithPattern(
        body.queryResult.fulfillmentMessages,
        `[].payload.error.${errMessage}`
      ) || errMessage;

    if (err.data) {
      let theVar = null;
      const re = /$_(\w+)/g;
      // eslint-disable-next-line no-cond-assign
      while ((theVar = re.exec(f.fulfillmentText))) {
        f.fulfillmentText = f.fulfillmentText.replace(
          `$_${theVar[1]}`,
          err.data[theVar[1]] || ''
        );
      }
    }
  }

  // Add anyway the complete error
  f.payload = { error: err };

  return f;
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
  let f = null;

  // If an action return a string, wrap into an object
  if (typeof actionResult === 'string') {
    actionResult = {
      fulfillmentText: actionResult
    };
  }

  f = actionResult;

  // Set context if not coming from webhooks
  if (!fromWebhook) {
    if (f.outputContexts) {
      for (const c of f.outputContexts) {
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

  return f;
}

/**
 * Accept a Generation action and resolve all outputs
 * @param {Object} body
 * @param {AsyncGenerator} generator
 * @param {Session} session
 */
async function generatorResolver(body, generator, session) {
  console.info(TAG, 'Using generator resolver', generator);
  try {
    for await (let f of generator) {
      f = await actionResultToFulfillment(body, f, session, false);
      await IOManager.output(f, session);
    }
  } catch (err) {
    console.error(TAG, 'error while executing action generator', err);
    const f = actionErrorTransformer(body, err);
    await IOManager.output(f, session);
  }
}

/**
 * Transform a body from DialogFlow into a Fulfillment by calling the internal action
 * @param {Object} body Payload from DialogFlow
 * @param {Object} session Session
 * @returns {Promise<Object>}
 */
async function actionResolver(body, session, fromWebhook = false) {
  const actionName = body.queryResult.action;
  console.info(TAG, `calling action <${actionName}>`);

  let f = null;

  try {
    // Actual call to the Action
    const actionToCall = Actions.list[actionName];
    if (actionToCall == null) {
      throw new Error(`Invalid action name: ${actionName}`);
    }

    f = await actionToCall()(body, session);

    // Now check if this action is a Promise or a Generator
    if (typeof f.next === 'function') {
      console.log('f', f);
      // Call the generator
      generatorResolver(body, f, session);
      // And immediately resolve
      return {
        payload: {
          handledByGenerator: true
        }
      };
    }

    f = await actionResultToFulfillment(body, f, session, fromWebhook);
  } catch (err) {
    console.error(TAG, 'error while executing action:', err);
    f = await actionErrorTransformer(body, err);
  }

  return f;
}

/**
 * Transform a text request to make it compatible and translating it
 * @param {String} text Sentence
 * @param {Object} session Session
 * @returns {Promise<Object>}
 */
async function textRequestTransformer(text, session) {
  // Remove the AI name in the text
  // text = text.replace(config.aiNameRegex, '');
  if (config.language !== session.getTranslateTo()) {
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
 * @returns {Promise<Object>}
 */
async function eventRequestTransformer(event, session) {
  if (typeof event === 'string') {
    event = { name: event };
  }
  event.languageCode = session.getTranslateFrom();
  return event;
}

/**
 * Parse the DialogFlow body and decide what to do
 * @param {Object} body Payload
 * @param {Object} session Session
 * @returns {Promise<Object>}
 */
async function bodyParser(body, session, fromWebhook = false) {
  if (config.mimicOfflineServer) {
    body.webhookStatus = null;
  }

  if (body.webhookStatus) {
    if (body.webhookStatus.code > 0) {
      return {
        error: body.webhookStatus
      };
    }

    // When coming from webhook, unwrap everything
    body.queryResult.parameters = structProtoToJson(
      body.queryResult.parameters
    );
    if (body.queryResult.webhookPayload) {
      body.queryResult.payload = structProtoToJson(
        body.queryResult.webhookPayload
      );
      delete body.queryResult.webhookPayload;
    }
    body.queryResult.payload = body.queryResult.payload || {};

    console.debug(TAG, 'Body parsed remotely by webhook');
    return body.queryResult;
  }

  // If an intent is returned, could auto resolve or call a promise
  if (!fromWebhook) {
    // When coming NOT from webhook,
    // parameters, fulfillmentMessages and payload are wrapped
    // in a very complicated STRUCT_PROTO
    // that is pretty unusable, so we just un-wrap
    body.queryResult.parameters = structProtoToJson(
      body.queryResult.parameters
    );
    body.queryResult.fulfillmentMessages = body.queryResult.fulfillmentMessages.map(
      e => ({
        payload: structProtoToJson(e.payload)
      })
    );
    body.queryResult.payload = structProtoToJson(body.queryResult.payload);
  }

  if (body.queryResult.action) {
    console.warn(TAG, 'Using action resolver locally');
    return actionResolver(body, session, fromWebhook);
  }

  // Otherwise, check if at least an intent is match and direct return that fulfillment
  if (body.queryResult.intent) {
    console.warn(TAG, 'Using queryResult object (matched from intent) locally');
    return {
      outputAudio: body.outputAudio,
      fulfillmentText: body.queryResult.fulfillmentText,
      fulfillmentMessages: body.queryResult.fulfillmentMessages,
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
 * @returns {Promise<Object>}
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
        text,
        languageCode: session.getTranslateFrom()
      }
    }
  });
  return bodyParser(responses[0], session);
}

/**
 * Make an event request to DialogFlow and let the flow begin
 * @param {Object} event Event object
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
      event
    }
  });
  return bodyParser(responses[0], session);
}

/**
 * Attach the AI to the Server
 */
function attachToServer() {
  Server.routerApi.post('/fulfillment', async (req, res) => {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.json({
        data: {
          error: 'Empty body'
        }
      });
    }

    console.info(TAG, '[WEBHOOK] received request');
    console.dir(req.body);

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

    let f = await bodyParser(req.body, session, true);
    f = await IOManager.fulfillmentTransformer(f, session);
    f = await fulfillmentTransformerForWebhookOutput(f, session);

    console.info(TAG, '[WEBHOOK] output fulfillment');
    console.log(JSON.stringify(f));

    return res.json(f);
  });
}

/**
 * Process a fulfillment to a session
 * @param {Object} e
 * @param {Object} e.fulfillment Fulfillment payload
 * @param {Object} e.session Session object
 */
async function processInput({ params, session }) {
  let f = null;

  console.info(TAG, 'output by input params', params);

  if (params.text) {
    IOManager.writeLogForSession(params.text, session);
    f = await textRequest(params.text, session);
  } else if (params.event) {
    f = await eventRequest(params.event, session);
  } else {
    console.warn('Neither { text, event } in params is not null');
  }

  return IOManager.output(f, session);
}

module.exports = {
  eventRequest,
  textRequest,
  processInput,
  attachToServer
};
