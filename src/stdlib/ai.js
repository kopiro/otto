/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
const DialogFlow = require("dialogflow");
const IOManager = require("./iomanager");
const Translator = require("../lib/translator");
const Data = require("../data/index");
const config = require("../config");
const {
  structProtoToJson,
  extractWithPattern,
  replaceVariablesInStrings
} = require("../helpers");

const dialogflow = DialogFlow.v2beta1;
const _config = config.dialogflow;

const dfSessionClient = new dialogflow.SessionsClient();
const dfContextsClient = new dialogflow.ContextsClient();

const TAG = "AI";

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
 * Transform a Fulfillment by making some edits based on the current session settings
 * @param  {Object} fulfillment Fulfillment object
 * @param  {Object} session Session object
 * @return {Promise<Object>}
 */
async function fulfillmentTransformerForSession(fulfillment = {}, session) {
  // If this fulfillment has already been transformed, let's skip this
  if (fulfillment.payload && fulfillment.payload.transformerUid) {
    return fulfillment;
  }

  // Ensure payload exists
  fulfillment.payload = fulfillment.payload || {};

  // Always translate fulfillment speech in the user language
  if (fulfillment.fulfillmentText) {
    if (session.getTranslateTo() !== config.language) {
      const translatedText = await Translator.translate(
        fulfillment.fulfillmentText,
        session.getTranslateTo()
      );
      if (fulfillment.fulfillmentText !== translatedText) {
        fulfillment.fulfillmentText = translatedText;
        fulfillment.payload.translatedTo = session.getTranslateTo();
      }
    }
  }

  fulfillment.payload.transformerUid = config.uid;
  fulfillment.payload.transformedAt = Date.now();
  return fulfillment;
}

/**
 * Clean fulfillment to be suitable for webhook
 * @param {Object} fulfillment Fulfillment
 * @param {Object} session Session
 * @returns
 */
function fulfillmentTransformerForWebhookOutput(fulfillment, session) {
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
  const dfSessionId = sessionId.replace(/\//g, "_");
  if (!_config.environment) {
    return dfSessionClient.sessionPath(_config.projectId, dfSessionId);
  }

  return dfSessionClient.environmentSessionPath(
    _config.projectId,
    _config.environment,
    "-",
    dfSessionId
  );
}

// function setDFContext(sessionId, context) {
//   return dfContextsClient.createContext({
//     parent: getDFSessionPath(sessionId),
//     context: parseContext(context, sessionId)
//   });
// }

/**
 * Transform an error into a fulfillment
 * @param {Object} body
 * @param {Error} err
 * @returns
 */
function actionErrorTransformer(body, err) {
  const fulfillment = {};

  if (err.message) {
    const errMessage = typeof err === "string" ? err : err.message;

    const textInPayload = extractWithPattern(
      body.queryResult.fulfillmentMessages,
      `[].payload.error.${errMessage}`
    );

    if (textInPayload) {
      // If an error occurs, try to intercept this error
      // in the fulfillmentMessages that comes from DialogFlow
      let text = textInPayload;
      if (err.data) {
        text = replaceVariablesInStrings(text, err.data);
      }
      fulfillment.fulfillmentText = text;
    } else {
      fulfillment.fulfillmentText = err.message.replace(/_/g, " ");
    }
  }

  // Add anyway the complete error
  fulfillment.payload = { error: err };

  return fulfillment;
}

/**
 * Transform the result of an action to a fulfillment.
 * It merges the input body with the action result
 * @param {Object} actionResult
 * @param {Object} session
 * @returns
 */
// eslint-disable-next-line no-unused-vars
function actionResultToFulfillment(actionResult, session) {
  // If an action return a string, wrap into an object
  if (typeof actionResult === "string") {
    return {
      fulfillmentText: actionResult
    };
  }

  return actionResult || {};

  // Set context if not coming from webhooks
  // if (!fromWebhook) {
  //   if (f.outputContexts) {
  //     for (const c of f.outputContexts) {
  //       console.info(
  //         TAG,
  //         "Setting context manually because we are not in a webhook",
  //         session.id,
  //         c
  //       );
  //       await setDFContext(session.id, c);
  //     }
  //   }
  // }
}

/**
 * Accept a Generation action and resolve all outputs
 * @param {Object} body
 * @param {AsyncGenerator} generator
 * @param {Session} session
 */
async function generatorResolver(body, generator, session) {
  console.info(TAG, "Using generator resolver", generator);

  try {
    for await (const fulfillment of generator) {
      await IOManager.output(
        await fulfillmentTransformerForSession(
          actionResultToFulfillment(fulfillment, session),
          session
        ),
        session
      );
    }
  } catch (err) {
    console.error(TAG, "error while executing action generator", err);
    await IOManager.output(
      await fulfillmentTransformerForSession(
        actionErrorTransformer(body, err),
        session
      ),
      session
    );
  }
}

/**
 * Transform a body from DialogFlow into a Fulfillment by calling the internal action
 * @param {Object} body Payload from DialogFlow
 * @param {Object} session Session
 * @returns {Promise<Object>}
 */
async function actionResolver(actionName, body, session) {
  console.info(TAG, `calling action <${actionName}>`);

  try {
    const [pkgName, pkgAction = "index"] = actionName.split(".");
    // TODO: avoid code injection
    const actionToCall = require(`../packages/${pkgName}/${pkgAction}`);
    if (!actionToCall) {
      throw new Error(`Invalid action name <${actionName}>`);
    }

    const actionResult = await actionToCall(body, session);

    // Now check if this action is a Promise or a Generator
    if (actionResult && typeof actionResult.next === "function") {
      // Call the generator async
      setImmediate(() => {
        generatorResolver(body, actionResult, session);
      });

      // And immediately resolve
      return {
        payload: {
          handledByGenerator: true
        }
      };
    }

    return actionResultToFulfillment(actionResult, session);
  } catch (err) {
    console.error(TAG, "error while executing action:", err);
    return actionErrorTransformer(body, err);
  }
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
    return Translator.translate(
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
  const _event = {};
  if (typeof event === "string") {
    _event.name = event;
  }
  _event.languageCode = session.getTranslateFrom();
  return _event;
}

/**
 * Returns a valid audio buffer
 * @param {Object} body Body
 * @param {Object} session Session
 */
function outputAudioParser(body, session) {
  // If there's no audio in the response, skip
  if (!body.outputAudio) return null;

  const audioLanguageCode = body.outputAudioConfig.synthesizeSpeechConfig.voice.name
    .substr(0, 2)
    .toLowerCase();

  // If the voice language doesn't match the session language, skip
  if (
    audioLanguageCode !== session.getTranslateTo() ||
    (body.queryResult &&
      body.queryResult.webhookPayload &&
      body.queryResult.webhookPayload.language &&
      body.queryResult.webhookPayload.language !== audioLanguageCode)
  ) {
    console.warn(
      TAG,
      "deleting outputAudio because of a voice language mismatch"
    );
    return null;
  }

  return {
    buffer: body.outputAudio,
    extension: body.outputAudioConfig.audioEncoding
      .replace("OUTPUT_AUDIO_ENCODING_", "")
      .toLowerCase()
  };
}

/**
 * Parse the DialogFlow webhook response
 * @param {Object} body
 */
async function webhookResponseToFulfillment(body, session) {
  console.debug(TAG, "using webhook response");

  if (body.webhookStatus.code > 0) {
    return {
      error: body.webhookStatus
    };
  }

  const { queryResult } = body;

  return {
    audio: outputAudioParser(body, session),
    fulfillmentText: queryResult.fulfillmentText,
    payload: queryResult.webhookPayload
      ? structProtoToJson(queryResult.webhookPayload)
      : {}
  };
}

/**
 * Parse the DialogFlow body and decide what to do
 * @param {Object} body Payload
 * @param {Object} session Session
 * @returns {Promise<Object>}
 */
async function bodyParser(body, session, localParser = true) {
  if (localParser && config.mimicOfflineServer) {
    console.error(TAG, "Miming an offline webhook server");
  }

  if (body.webhookStatus && !config.mimicOfflineServer) {
    return webhookResponseToFulfillment(body, session);
  }

  if (localParser) {
    // When not coming from webhook, these structures are wrapped
    body.queryResult.parameters = structProtoToJson(
      body.queryResult.parameters
    );
    body.queryResult.fulfillmentMessages = body.queryResult.fulfillmentMessages.map(
      e => ({
        payload: structProtoToJson(e.payload)
      })
    );
  }

  // If we have an "action", call the package with the specified name
  if (body.queryResult.action) {
    console.debug(TAG, `Resolving action <${body.queryResult.action}>`);
    return actionResolver(body.queryResult.action, body, session);
  }

  // Otherwise, check if at least an intent is match and direct return that fulfillment
  if (body.queryResult.intent) {
    console.debug(
      TAG,
      "Using body.queryResult object (matched from intent)",
      body.queryResult
    );

    const {
      queryText,
      fulfillmentText,
      fulfillmentMessages,
      parameters
    } = body.queryResult;

    // Merge all objects from fulfillmentMessages into payload
    // TODO: what if multiple first-level keys are the same?
    let payload = {};
    fulfillmentMessages.forEach(message => {
      payload = { ...payload, ...message.payload };
    });

    let audio;
    if (localParser) {
      audio = outputAudioParser(body, session);
    }

    return {
      audio,
      parameters,
      queryText,
      fulfillmentText,
      payload
    };
  }

  // If not intentId is returned, this is a unhandled DialogFlow intent
  // So make another event request to inform user (ai_unhandled)
  console.info(TAG, "Using ai_unhandled followupEventInput");
  return {
    followupEventInput: {
      name: "ai_unhandled"
    }
  };
}

/**
 * Make a text request to DialogFlow and let the flow begin
 * @param {String} text Sentence
 * @param {Object} session Session
 * @returns {Promise<Object>}
 */
async function textRequest(textArg, session) {
  console.info(TAG, "text request:", textArg);

  // Transform the text to eventually translate it
  const text = await textRequestTransformer(textArg, session);

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
async function eventRequest(eventArg, session) {
  console.info(TAG, "event request:", eventArg);

  // Transform the text to eventually translate it
  const event = await eventRequestTransformer(eventArg, session);

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
function attachToServer(serverInstance) {
  serverInstance.routerApi.post("/fulfillment", async (req, res) => {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.json({
        data: {
          error: "ERR_EMPTY_BODY"
        }
      });
    }

    console.info(TAG, "[WEBHOOK]", "received request", req.body);

    const sessionId = req.body.session.split("/").pop();

    // From AWH can came any session ID, so ensure it exists on our DB
    let session = await Data.Session.findById(sessionId);
    if (!session) {
      console.error(TAG, `creating a missing session ID with ${sessionId}`);
      session = new Data.Session({
        _id: sessionId
      });
      await session.save();
    }

    const fulfillment = fulfillmentTransformerForWebhookOutput(
      await fulfillmentTransformerForSession(
        await bodyParser(req.body, session, false),
        session
      ),
      session
    );

    console.info(TAG, "[WEBHOOK]", "output fulfillment", fulfillment);

    return res.json(fulfillment);
  });
}
/**
 * Process a fulfillment to a session
 * @param {Object} e
 * @param {Object} e.params Input params
 * @param {String} e.params.text Text
 * @param {String} e.params.event Event
 * @param {Object} e.session Session object
 */
async function processInput({ params = {}, session }) {
  const { text, event } = params;
  let fulfillment = null;

  if (session.repeatModeSession) {
    console.info(TAG, "using repeatModeSession", session.repeatModeSession);
    return IOManager.output(
      await fulfillmentTransformerForSession(
        { fulfillmentText: text },
        session.repeatModeSession
      ),
      session.repeatModeSession
    );
  }

  IOManager.writeLogForSession(params, session);

  if (text) {
    fulfillment = await textRequest(text, session);
  } else if (event) {
    fulfillment = await eventRequest(event, session);
  } else {
    console.warn("Neither { text, event } in params is not null");
  }

  return IOManager.output(
    await fulfillmentTransformerForSession(fulfillment, session),
    session
  );
}

module.exports = {
  eventRequest,
  textRequest,
  processInput,
  attachToServer
};
