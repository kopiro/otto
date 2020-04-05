import { v2 as dialogflow } from "dialogflow";
import * as IOManager from "./iomanager";
import * as Translator from "../interfaces/translator";
import config from "../config";
import { extractWithPattern, replaceVariablesInStrings } from "../helpers";
import {
  Fulfillment,
  CustomError,
  AIAction,
  Language,
  InputParams,
  BufferWithExtension,
  Session as ISession,
} from "../types";
import { struct, Struct } from "pb-util";
import { Request, Response } from "express";
import { Session } from "../data";

type IDetectIntentResponse = Record<string, any>;
type IEventInput = Record<string, any>;
type ITextInput = Record<string, any>;
type WebhookRequest = Record<string, any>;
type WebhookResponse = Record<string, any>;
type IQueryInput = Record<string, any>;
type OutputAudioEncoding = Record<string, any>;

const _config = config().dialogflow;

const dfSessionClient = new dialogflow.SessionsClient();
const dfContextsClient = new dialogflow.ContextsClient();

const TAG = "AI";

/**
 * Transform a Fulfillment by making some edits based on the current session settings
 */
export async function fulfillmentTransformerForSession(
  fulfillment: Fulfillment,
  session: ISession,
): Promise<Fulfillment> {
  // If this fulfillment has already been transformed, let's skip this
  if (fulfillment.payload?.transformerUid) {
    return fulfillment;
  }

  // Always translate fulfillment speech in the user language
  if (fulfillment.fulfillmentText) {
    if (session.getTranslateTo() !== config().language) {
      fulfillment.fulfillmentText = await Translator.translate(
        fulfillment.fulfillmentText,
        session.getTranslateTo(),
        config().language,
      );
      fulfillment.payload.translatedTo = session.getTranslateTo();
    } else if (fulfillment.payload?.translateFrom) {
      fulfillment.fulfillmentText = await Translator.translate(
        fulfillment.fulfillmentText,
        session.getTranslateTo(),
        fulfillment.payload.translateFrom,
      );
      fulfillment.payload.translatedTo = session.getTranslateTo();
    }
  }

  fulfillment.payload = fulfillment.payload || {};
  fulfillment.payload.transformerUid = config().uid;
  fulfillment.payload.transformedAt = Date.now();

  return fulfillment;
}

/**
 * Get the session path suitable for DialogFlow
 */
function getDFSessionPath(session: ISession) {
  const dfSessionId = session.id.replace(/\//g, "_");
  if (!_config.environment) {
    return dfSessionClient.sessionPath(_config.projectId, dfSessionId);
  }

  return dfSessionClient.environmentSessionPath(_config.projectId, _config.environment, "-", dfSessionId);
}

// function setDFContext(sessionId, context) {
//   return dfContextsClient.createContext({
//     parent: getDFSessionPath(sessionId),
//     context: parseContext(context, sessionId)
//   });
// }

/**
 * Transform an error into a fulfillment
 */
function actionErrorTransformer(body: IDetectIntentResponse, error: CustomError): Fulfillment {
  const fulfillment: Fulfillment = {};

  if (error.message) {
    const errMessage = error.message;

    const textInPayload = extractWithPattern(body.queryResult.fulfillmentMessages, `[].payload.error.${errMessage}`);

    if (textInPayload) {
      // If an error occurs, try to intercept this error
      // in the fulfillmentMessages that comes from DialogFlow
      let text = textInPayload;
      if (error.data) {
        text = replaceVariablesInStrings(text, error.data);
      }
      fulfillment.fulfillmentText = text;
    } else {
      fulfillment.fulfillmentText = error.message.replace(/_/g, " ");
    }
  }

  // Add anyway the complete error
  fulfillment.payload = { error };

  return fulfillment;
}

/**
 * Accept a Generation action and resolve all outputs
 */
export async function generatorResolver(
  body: IDetectIntentResponse,
  fulfillmentGenerator: IterableIterator<Fulfillment>,
  session: ISession,
): Promise<[Fulfillment, boolean][]> {
  console.info(TAG, "Using generator resolver", fulfillmentGenerator);

  const fulfillmentsAndOutputResults: [Fulfillment, boolean][] = [];

  for await (const fulfillment of fulfillmentGenerator) {
    let outputResult: boolean;
    let trFulfillment: Fulfillment;

    try {
      trFulfillment = await fulfillmentTransformerForSession(fulfillment, session);
      outputResult = await IOManager.output(trFulfillment, session);
    } catch (err) {
      console.error(TAG, "error while executing action generator", err);
      trFulfillment = actionErrorTransformer(body, err);
      trFulfillment = await fulfillmentTransformerForSession(trFulfillment, session);
      outputResult = await IOManager.output(trFulfillment, session);
    }

    fulfillmentsAndOutputResults.push([trFulfillment, outputResult]);
  }

  return fulfillmentsAndOutputResults;
}

/**
 * Transform a body from DialogFlow into a Fulfillment by calling the internal action
 */
export async function actionResolver(
  actionName: string,
  body: Record<string, any>,
  session: ISession,
): Promise<Fulfillment> {
  console.info(TAG, `calling action <${actionName}>`);
  let fulfillment: Fulfillment = null;

  try {
    const [pkgName, pkgAction = "index"] = actionName.split(".");
    // TODO: avoid code injection
    const actionToCall = (await import(`../packages/${pkgName}/${pkgAction}`)).default as AIAction;
    if (!actionToCall) {
      throw new Error(`Invalid action name <${actionName}>`);
    }

    const actionResult = await actionToCall(body, session);

    // Now check if this action is a Promise or a Generator
    if (actionResult.constructor.name === "GeneratorFunction") {
      // Call the generator async
      setImmediate(() => {
        generatorResolver(body, actionResult as IterableIterator<Fulfillment>, session);
      });

      // And immediately resolve
      fulfillment = {
        payload: {
          handledByGenerator: true,
        },
      };
    } else {
      if (typeof actionResult === "string") {
        fulfillment = { fulfillmentText: actionResult };
      } else {
        fulfillment = actionResult as Fulfillment;
      }
    }
  } catch (err) {
    console.error(TAG, "error while executing action:", err);
    fulfillment = actionErrorTransformer(body, err);
  }

  return fulfillment;
}

/**
 * Transform a text request to make it compatible and translating it
 */
export async function textRequestTransformer(text: InputParams["text"], session: ISession): Promise<ITextInput> {
  const trText: ITextInput = {};

  trText.languageCode = session.getTranslateTo();
  if (config().language !== session.getTranslateTo()) {
    trText.text = await Translator.translate(text, config().language, session.getTranslateTo());
  } else {
    trText.text = text;
  }

  return trText;
}

/**
 * Transform an event by making compatible
 */
export async function eventRequestTransformer(event: InputParams["event"], session: ISession): Promise<IEventInput> {
  const trEvent: IEventInput = {};

  if (typeof event === "string") {
    trEvent.name = event;
  } else {
    Object.assign(trEvent, event);
  }

  trEvent.languageCode = session.getTranslateTo();

  return trEvent;
}

/**
 * Returns a valid audio buffer
 */
function outputAudioParser(body: IDetectIntentResponse, session: ISession): BufferWithExtension | null {
  // If there's no audio in the response, skip
  if (!body.outputAudio) {
    return null;
  }

  const audioLanguageCode = body.outputAudioConfig.synthesizeSpeechConfig?.voice.name
    .substr(0, 2)
    .toLowerCase() as Language;

  const payloadLanguageCode = struct.decode(body.queryResult.webhookPayload as Struct).language as Language;

  // If the voice language doesn't match the session language, skip
  if (audioLanguageCode !== session.getTranslateTo() || audioLanguageCode !== payloadLanguageCode) {
    console.warn(TAG, "deleting outputAudio because of a voice language mismatch");
    return null;
  }

  return {
    buffer: body.outputAudio,
    extension: config().audio.extension,
  };
}

/**
 * Parse the DialogFlow webhook response
 */
export function webhookResponseToFulfillment(body: IDetectIntentResponse, session: ISession): Fulfillment {
  const { queryResult, webhookStatus } = body;

  if (webhookStatus.code > 0) {
    return {
      payload: {
        error: {
          message: webhookStatus.message,
        },
      },
    };
  }

  return {
    fulfillmentText: queryResult.fulfillmentText,
    audio: outputAudioParser(body, session),
    payload: struct.decode(queryResult.webhookPayload as Struct),
  };
}

/**
 * Parse the DialogFlow body and decide what to do
 */
export async function bodyParser(
  body: IDetectIntentResponse | WebhookRequest,
  session: ISession,
): Promise<Fulfillment> {
  if (config().mimicOfflineServer) {
    console.warn(TAG, "!!! Miming an offline webhook server !!!");
  } else {
    if ("webhookStatus" in body) {
      console.debug(TAG, "using webhook response");
      return webhookResponseToFulfillment(body as IDetectIntentResponse, session);
    }
  }

  // If we have an "action", call the package with the specified name
  if (body.queryResult.action) {
    console.debug(TAG, `Resolving action <${body.queryResult.action}>`);
    return actionResolver(body.queryResult.action, body, session);
  }

  // Otherwise, check if at least an intent is match and direct return that fulfillment
  if (body.queryResult.intent) {
    console.debug(TAG, "Using body.queryResult object (matched from intent)", body.queryResult);

    // const fulfillmentMessages = body.queryResult.fulfillmentMessages;
    // const parameters = body.queryResult.parameters;

    // // Merge all objects from fulfillmentMessages into payload
    // // TODO: what if multiple first-level keys are the same?
    // let payload = {};
    // fulfillmentMessages.forEach(message => {
    //   payload = { ...payload, ...message.payload };
    // });

    return {
      fulfillmentText: body.queryResult.fulfillmentText,
      audio: "webhookStatus" in body ? outputAudioParser(body, session) : null,
    };
  }

  // If not intentId is returned, this is a unhandled DialogFlow intent
  // So make another event request to inform user (ai_unhandled)
  console.info(TAG, "Using ai_unhandled followupEventInput");
  return {
    followupEventInput: {
      name: "ai_unhandled",
    },
  };
}

async function request(queryInput: IQueryInput, session: ISession): Promise<IDetectIntentResponse> {
  const response = await dfSessionClient.detectIntent({
    session: getDFSessionPath(session),
    queryInput,
    queryParams: {
      sentimentAnalysisRequestConfig: {
        analyzeQueryTextSentiment: true,
      },
    },
    outputAudioConfig: {
      audioEncoding: (`OUTPUT_AUDIO_ENCODING_${config().audio.encoding}` as unknown) as OutputAudioEncoding,
    },
  });
  return response[0] as IDetectIntentResponse;
}

/**
 * Make a text request to DialogFlow and let the flow begin
 */
export async function textRequest(_text: string, session: ISession): Promise<Fulfillment> {
  console.info(TAG, "text request:", _text);

  const text = await textRequestTransformer(_text, session);
  const response = await request({ text }, session);
  const fulfillment = await bodyParser(response, session);
  return fulfillment;
}

/**
 * Make an event request to DialogFlow and let the flow begin
 */
export async function eventRequest(_event: InputParams["event"], session: ISession): Promise<Fulfillment> {
  console.info(TAG, "event request:", _event);

  const event = await eventRequestTransformer(_event, session);
  const response = await request({ event }, session);
  const fulfillment = await bodyParser(response, session);
  return fulfillment;
}

/**
 * The endpoint closure used by the webhook
 */
export async function fulfillmentEndpoint(req: Request, res: Response) {
  console.info(TAG, "[WEBHOOK]", "received request", JSON.stringify(req.body));

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      error: "ERR_EMPTY_BODY",
    });
  }

  const body = req.body as WebhookRequest;

  const sessionId = (body.session as string).split("/").pop();
  let session = await IOManager.getSession(sessionId);
  if (!session) {
    session = new Session();
  }

  let fulfillment = await bodyParser(body, session);
  fulfillment = await fulfillmentTransformerForSession(fulfillment, session);

  console.info(TAG, "[WEBHOOK]", "output fulfillment", fulfillment);

  const response = fulfillment as WebhookResponse;
  response.outputContexts = (response.outputContexts || []).map(ctx => {
    ctx.name = dfContextsClient.contextPath(_config.projectId, session.id, ctx.name);
    return ctx;
  });

  return res.status(200).json(response);
}

/**
 * Attach the AI to the Server
 */
export function attachToServer(serverInstance) {
  serverInstance.routerApi.post("/fulfillment", fulfillmentEndpoint);
}

/**
 * Process a fulfillment to a session
 */
export async function processInput(params: InputParams, session: ISession) {
  const { text, event } = params;
  console.info(TAG, "processInput", { params, session });

  if (session.repeatModeSession) {
    console.info(TAG, "using repeatModeSession", session.repeatModeSession);
    const fulfillment = await fulfillmentTransformerForSession({ fulfillmentText: text }, session.repeatModeSession);
    return IOManager.output(fulfillment, session.repeatModeSession);
  }

  IOManager.writeLogForSession(params, session);

  let fulfillment: any = null;
  if (text) {
    fulfillment = await textRequest(text, session);
  } else if (event) {
    fulfillment = await eventRequest(event, session);
  } else {
    console.warn("Neither { text, event } in params is not null");
  }

  fulfillment = await fulfillmentTransformerForSession(fulfillment, session);
  return IOManager.output(fulfillment, session);
}
