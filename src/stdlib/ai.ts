import dialogflow, { protos } from "@google-cloud/dialogflow";
import * as IOManager from "./iomanager";
import Translator from "../stdlib/translator";
import config from "../config";
import { extractWithPattern, replaceVariablesInStrings, getAiNameRegex } from "../helpers";
import { Fulfillment, CustomError, AIAction, InputParams, BufferWithExtension, Session as ISession } from "../types";
import { struct, Struct } from "pb-util";
import { Request, Response } from "express";
import { Log } from "./log";
import SpeechRecognizer from "../stdlib/speech-recognizer";
import Events from "events";
import { SessionsClient, IntentsClient } from "@google-cloud/dialogflow/build/src/v2";
import openAI from "./openai";

type IStruct = protos.google.protobuf.IStruct;

type IDetectIntentResponse = protos.google.cloud.dialogflow.v2.IDetectIntentResponse;
type IEventInput = protos.google.cloud.dialogflow.v2.IEventInput;
type ITextInput = protos.google.cloud.dialogflow.v2.ITextInput;
type IContext = protos.google.cloud.dialogflow.v2.IContext;
type IMessage = protos.google.cloud.dialogflow.v2.Intent.IMessage;
type WebhookRequest = protos.google.cloud.dialogflow.v2.WebhookRequest;
type WebhookResponse = protos.google.cloud.dialogflow.v2.WebhookResponse;
type IQueryInput = protos.google.cloud.dialogflow.v2.IQueryInput;
type OutputAudioEncoding = protos.google.cloud.dialogflow.v2.OutputAudioEncoding;

type ResponseBody = IDetectIntentResponse & {
  queryResult: {
    parameters: Record<string, any> | null;
    webhookPayload: Record<string, any> | null;
    outputContexts: (IContext & { parameters: Record<string, any> })[];
    fulfillmentMessages: (IMessage & { payload: Record<string, any> })[];
  };
};

const TAG = "AI";
const log = new Log(TAG);

export type AIConfig = {
  projectId: string;
  environment?: string;
};

type CommandFunction = (args: RegExpMatchArray, session: ISession, bag: IOManager.IOBag) => Promise<Fulfillment>;

class AI {
  config: AIConfig;

  dfSessionClient: SessionsClient = new dialogflow.SessionsClient();
  dfIntentsClient: IntentsClient = new dialogflow.IntentsClient();
  emitter: Events.EventEmitter = new Events.EventEmitter();

  dfIntentAgentPath: string;

  commandMapping: Array<{
    matcher: RegExp;
    executor: CommandFunction;
    description: string;
    authorization?: IOManager.Authorizations;
  }> = [
    {
      matcher: /^\/textout ([^\s]+) (.+)/,
      executor: this.commandOut,
      description: "textout - [sessionid] [text] - Send a text message to a specific session",
      authorization: IOManager.Authorizations.COMMAND,
    },
    {
      matcher: /^\/textin ([^\s]+) (.+)/,
      executor: this.commandIn,
      description: "textin - [sessionid] [text] - Process an input text for a specific session",
      authorization: IOManager.Authorizations.COMMAND,
    },
    {
      matcher: /^\/appstop/,
      executor: this.commandAppStop,
      description: "appstop - Cause the application to crash",
      authorization: IOManager.Authorizations.COMMAND,
    },
    {
      matcher: /^\/whoami/,
      executor: this.commandWhoami,
      description: "whoami - Get your session",
    },
  ];

  constructor(config: AIConfig) {
    this.config = config;
    this.dfIntentAgentPath = this.dfIntentsClient.agentPath(this.config.projectId);
  }

  getCommandMappingDescription() {
    return this.commandMapping.map(({ description }) => `${description}`).join("\n");
  }

  private async commandNotAuthorized(): Promise<Fulfillment> {
    return { fulfillmentText: "User not authorized" };
  }

  private async commandNotFound(): Promise<Fulfillment> {
    return { fulfillmentText: "Command not found" };
  }

  private async commandAppStop(): Promise<Fulfillment> {
    setTimeout(() => process.exit(0), 5000);
    return { fulfillmentText: "Scheduled shutdown in 5 seconds" };
  }

  private async commandWhoami(_: RegExpMatchArray, session: ISession): Promise<Fulfillment> {
    return { payload: { data: JSON.stringify(session, null, 2) } };
  }

  private async commandIn([, cmdSessionId, cmdText]: RegExpMatchArray): Promise<Fulfillment> {
    const cmdSession = await IOManager.getSession(cmdSessionId);
    const result = await this.processInput({ text: cmdText }, cmdSession);
    return { payload: { data: JSON.stringify(result, null, 2) } };
  }

  private async commandOut([, cmdSessionId, cmdText]: RegExpMatchArray): Promise<Fulfillment> {
    const cmdSession = await IOManager.getSession(cmdSessionId);
    const result = await IOManager.output({ fulfillmentText: cmdText }, cmdSession, {});
    return { payload: { data: JSON.stringify(result, null, 2) } };
  }

  getCommandExecutor(
    text: string,
    session: ISession,
  ): (session: ISession, bag: IOManager.IOBag) => Promise<Fulfillment> {
    for (const cmd of this.commandMapping) {
      const matches = text.match(cmd.matcher);
      if (matches) {
        if (
          session.authorizations.includes(cmd.authorization) ||
          session.authorizations.includes(IOManager.Authorizations.ADMIN) ||
          cmd.authorization == null
        ) {
          return (session: ISession, bag: IOManager.IOBag) => cmd.executor(matches, session, bag);
        } else {
          return () => this.commandNotAuthorized();
        }
      }
    }

    return () => this.commandNotFound();
  }

  decodeIfStruct(s: IStruct): Record<string, any> {
    return s && s.fields ? struct.decode(s as Struct) : s;
  }

  /**
   * Decode an IDetectIntentResponse into a fully decodable body
   */
  decodeDetectIntentResponse(body: IDetectIntentResponse | WebhookRequest): ResponseBody {
    const { parameters, webhookPayload, fulfillmentMessages = [], outputContexts = [] } = body.queryResult;
    return {
      ...body,
      queryResult: {
        ...body.queryResult,
        parameters: this.decodeIfStruct(parameters),
        webhookPayload: this.decodeIfStruct(webhookPayload),
        fulfillmentMessages: fulfillmentMessages.map((e) => ({
          ...e,
          payload: this.decodeIfStruct(e.payload),
        })),
        outputContexts: outputContexts.map((e) => ({ ...e, parameters: this.decodeIfStruct(e.parameters) })),
      },
    };
  }

  async train(queryText: string, answer: string) {
    console.debug(TAG, "TRAIN request", { queryText, answer });
    const response = await this.dfIntentsClient.createIntent({
      parent: this.dfIntentAgentPath,
      languageCode: config().language,
      intent: {
        displayName: `M-TRAIN: ${queryText}`.substr(0, 100),
        trainingPhrases: [
          {
            type: "EXAMPLE",
            parts: [{ text: queryText }],
          },
        ],
        messages: [
          {
            text: {
              text: [answer],
            },
          },
        ],
        webhookState: "WEBHOOK_STATE_ENABLED",
      },
    });
    console.debug(TAG, "TRAIN response", response);
    return response;
  }

  /**
   * Transform a Fulfillment by making some edits based on the current session settings
   */
  async fulfillmentTransformerForSession(fulfillment: Fulfillment, session: ISession): Promise<Fulfillment> {
    if (!fulfillment) return;

    fulfillment.payload = fulfillment.payload || {};

    // If this fulfillment has already been transformed, let's skip this
    if (fulfillment.payload.transformerUid) {
      return fulfillment;
    }

    // Always translate fulfillment speech in the user language
    if (fulfillment.fulfillmentText) {
      const from = fulfillment.payload.translateFrom || session.getTranslateFrom();
      const to = fulfillment.payload.translateTo || session.getTranslateTo();
      if (from !== config().language || to !== config().language) {
        fulfillment.fulfillmentText = await Translator.translate(fulfillment.fulfillmentText, to, from);
        fulfillment.payload.didTranslatedFrom = from;
        fulfillment.payload.didTranslatedTo = to;
      }
    }

    fulfillment.payload.transformerUid = config().uid;
    fulfillment.payload.transformedAt = Date.now();

    return fulfillment;
  }

  /**
   * Get the session path suitable for DialogFlow
   */
  getDFSessionPath(session: ISession) {
    const dfSessionId = session.id.replace(/\//g, "_");
    if (!this.config.environment) {
      return this.dfSessionClient.projectAgentSessionPath(this.config.projectId, dfSessionId);
    }

    return this.dfSessionClient.projectAgentEnvironmentUserSessionPath(
      this.config.projectId,
      this.config.environment,
      "-",
      dfSessionId,
    );
  }

  /**
   * Transform an error into a fulfillment
   */
  actionErrorTransformer(body: ResponseBody, error: CustomError): Fulfillment {
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
      }
    }

    // Add anyway the complete error
    fulfillment.payload = { error };

    return fulfillment;
  }

  /**
   * Accept a Generation action and resolve all outputs
   */
  async generatorResolver(
    body: ResponseBody,
    fulfillmentGenerator: IterableIterator<Fulfillment>,
    session: ISession,
    bag: IOManager.IOBag,
  ): Promise<[Fulfillment, IOManager.OutputResult][]> {
    console.info(TAG, "Using generator resolver", fulfillmentGenerator);

    const fulfillmentsAndOutputResults: [Fulfillment, IOManager.OutputResult][] = [];

    for await (const fulfillment of fulfillmentGenerator) {
      let outputResult: IOManager.OutputResult;
      let trFulfillment: Fulfillment;

      try {
        trFulfillment = await this.fulfillmentTransformerForSession(fulfillment, session);
        outputResult = await IOManager.output(trFulfillment, session, bag);
      } catch (err) {
        console.error(TAG, "error while executing action generator", err);
        trFulfillment = this.actionErrorTransformer(body, err);
        trFulfillment = await this.fulfillmentTransformerForSession(trFulfillment, session);
        outputResult = await IOManager.output(trFulfillment, session, bag);
      }

      fulfillmentsAndOutputResults.push([trFulfillment, outputResult]);
    }

    return fulfillmentsAndOutputResults;
  }

  handleSystemPackages(pkgName: string, body: ResponseBody, session: ISession): any {
    const { queryResult } = body;

    switch (pkgName) {
      case "train":
        this.train(queryResult.outputContexts[0].parameters.queryText, queryResult.queryText);
        return body.queryResult;

      case "do_not_disturb_on":
        this.doNotDisturb(true, session);
        return body.queryResult;

      case "do_not_disturb_off":
        this.doNotDisturb(false, session);
        return body.queryResult;

      default:
        return false;
    }
  }

  doNotDisturb(value: boolean, session: ISession) {
    session.doNotDisturb = value;
    return session.save();
  }

  /**
   * Transform a body from DialogFlow into a Fulfillment by calling the internal action
   */
  async actionResolver(
    actionName: string,
    body: ResponseBody,
    session: ISession,
    bag: IOManager.IOBag,
  ): Promise<Fulfillment> {
    console.info(TAG, `calling action <${actionName}>`);

    let fulfillment: Fulfillment = null;

    try {
      const [pkgName, pkgAction = "index"] = actionName.split(".");

      const sysPkgFullfillment = this.handleSystemPackages(pkgName, body, session);
      if (sysPkgFullfillment !== false) {
        return sysPkgFullfillment;
      }

      // TODO: avoid code injection
      const pkg = await import(`../packages/${pkgName}/${pkgAction}`);
      if (!pkg) {
        throw new Error(`Invalid action name <${actionName}>`);
      }

      const pkgAuthorizations = (pkg.authorizations || []) as IOManager.Authorizations[];
      const sessionAuthorizations = session.authorizations || [];
      for (const pkgAuth of pkgAuthorizations) {
        if (!sessionAuthorizations.includes(pkgAuth)) {
          throw new Error(`Missing ${pkgAuth} authorization for your session`);
        }
      }

      const pkgCallable = pkg.default as AIAction;
      const actionResult = await pkgCallable(body, session, bag);

      // Now check if this action is a Promise or a Generator
      if (actionResult.constructor.name === "GeneratorFunction") {
        // Call the generator async
        setImmediate(() => {
          this.generatorResolver(body, actionResult as IterableIterator<Fulfillment>, session, bag);
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
      fulfillment = this.actionErrorTransformer(body, err);
    }

    return fulfillment;
  }

  /**
   * Transform a text request to make it compatible and translating it
   */
  async textRequestTransformer(text: InputParams["text"], session: ISession): Promise<ITextInput> {
    const trText: ITextInput = {};

    // Remove any reference to the AI name
    const cleanText = text.replace(getAiNameRegex(), "");

    if (config().language !== session.getTranslateTo()) {
      trText.text = await Translator.translate(cleanText, config().language, session.getTranslateTo());
    } else {
      trText.text = cleanText;
    }

    trText.languageCode = session.getTranslateTo();

    return trText;
  }

  /**
   * Transform an event by making compatible
   */
  async eventRequestTransformer(event: InputParams["event"], session: ISession): Promise<IEventInput> {
    let trEvent: IEventInput;

    if (typeof event === "string") {
      trEvent = { name: event };
    } else {
      trEvent = { name: event.name, parameters: event.parameters ? struct.encode(event.parameters) : {} };
    }

    trEvent.languageCode = session.getTranslateTo();

    return trEvent;
  }

  /**
   * Returns a valid audio buffer
   */
  outputAudioParser(body: ResponseBody, session: ISession): BufferWithExtension | null {
    // If there's no audio in the response, skip
    if (!body.outputAudio) {
      console.warn(TAG, `there is not outputAudio in the response`);
      return null;
    }

    // If the voice language doesn't match the session language, skip
    const payloadLanguageCode = body.queryResult.webhookPayload?.language;
    if (payloadLanguageCode && payloadLanguageCode !== config().language) {
      console.warn(TAG, `deleting outputAudio because of a voice language mismatch (${payloadLanguageCode})`);
      return null;
    }

    if (session.getTranslateTo() !== config().language) {
      console.warn(TAG, `deleting outputAudio because of a voice language mismatch (${session.getTranslateTo()})`);
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
  alreadyParsedByWebhookResponseToFulfillment(body: ResponseBody, session: ISession): Fulfillment {
    if (body.webhookStatus?.code > 0) {
      return {
        payload: {
          error: {
            message: body.webhookStatus.message,
          },
        },
      };
    }

    return {
      fulfillmentText: body.queryResult.fulfillmentText,
      audio: this.outputAudioParser(body, session),
      payload: body.queryResult.webhookPayload as Record<string, any>,
    };
  }

  /**
   * Parse the DialogFlow body and decide what to do
   */
  async bodyParser(body: ResponseBody, session: ISession, bag: IOManager.IOBag, referer = ""): Promise<Fulfillment> {
    const alreadyParsedByWebhook = "webhookStatus" in body && body.webhookStatus?.code === 0;
    const tmpTag = `${TAG}${referer}`;

    if (true || config().mimicOfflineServer) {
      console.warn(tmpTag, "!!! Miming an offline webhook server !!!");
    } else {
      if (alreadyParsedByWebhook) {
        console.debug(tmpTag, "using response already parsed by the webhook");
        log.write(session.id, "body_parser_parsed_from_webhook", body);
        return this.alreadyParsedByWebhookResponseToFulfillment(body, session);
      }
    }

    log.write(session.id, "body_parser", body);

    // If we have an "action", call the package with the specified name
    if (body.queryResult.action) {
      console.debug(tmpTag, `Resolving action <${body.queryResult.action}>`);
      return this.actionResolver(body.queryResult.action, body, session, bag);
    }

    // Otherwise, check if at least an intent is match and direct return that fulfillment
    if (body.queryResult.intent) {
      console.debug(
        tmpTag,
        "Using body.queryResult object (matched from intent)",
        body.queryResult,
        alreadyParsedByWebhook,
      );

      // If the intent is a fallback intent, invoke a procedure to ask to be trained
      if (body.queryResult.intent.isFallback) {
        console.debug(tmpTag, `Training invoked`);

        if (config().trainingSessionId) {
          setImmediate(async () => {
            const trainingSession = await IOManager.getSession(config().trainingSessionId);
            this.processInput(
              {
                event: { name: "training", parameters: { queryText: body.queryResult.queryText } },
              },
              trainingSession,
            );
          });
        }

        // Reset if 5m have passed since last interaction
        const now = Math.floor(Date.now() / 1000);
        if (session.pipe?.openAILastInteraction) {
          if (session.pipe.openAILastInteraction + 60 * 5 < now) {
            console.log(TAG, "resetting openaiChatLog", session.pipe);
            session.savePipe({
              openAIChatLog: "",
            });
          }
        }

        const { text, chatLog } = await openAI(body.queryResult.queryText, session, session.pipe?.openAIChatLog);
        session.savePipe({
          openAILastInteraction: now,
          openAIChatLog: chatLog,
        });
        return {
          fulfillmentText: `** ${text}`,
        };
      }

      return {
        fulfillmentText: body.queryResult.fulfillmentText,
        audio: this.outputAudioParser(body, session),
      };
    }

    // If not intentId is returned, this is a unhandled DialogFlow intent
    // So make another event request to inform user (ai_unhandled)
    console.info(tmpTag, "Using ai_unhandled followupEventInput");
    return {
      followupEventInput: {
        name: "ai_unhandled",
      },
    };
  }

  async request(queryInput: IQueryInput, session: ISession, bag?: IOManager.IOBag): Promise<IDetectIntentResponse> {
    const payload = {
      session: this.getDFSessionPath(session),
      queryInput,
      queryParams: {
        payload: bag?.encodable ? struct.encode(bag.encodable) : {},
        sentimentAnalysisRequestConfig: {
          analyzeQueryTextSentiment: true,
        },
      },
      outputAudioConfig: {
        audioEncoding: (`OUTPUT_AUDIO_ENCODING_${config().audio.encoding}` as unknown) as OutputAudioEncoding,
      },
    };
    const [response] = await this.dfSessionClient.detectIntent(payload);
    log.write(session.id, "sent_detect_intent", payload);

    return response;
  }

  /**
   * Get the command to execute and return an executor
   */
  async commandRequest(_command: string, session: ISession, bag: IOManager.IOBag): Promise<Fulfillment> {
    console.info(TAG, "command request:", _command);

    const commandExecutor = this.getCommandExecutor(_command, session);
    try {
      return commandExecutor(session, bag);
    } catch (err) {
      return { payload: { error: err } };
    }
  }

  /**
   * Make a text request to DialogFlow and let the flow begin
   */
  async textRequest(_text: string, session: ISession, bag: IOManager.IOBag): Promise<Fulfillment> {
    console.info(TAG, "text request:", _text);

    const text = await this.textRequestTransformer(_text, session);
    const response = await this.request({ text }, session, bag);
    const body = this.decodeDetectIntentResponse(response);
    return this.bodyParser(body, session, bag);
  }

  /**
   * Make an event request to DialogFlow and let the flow begin
   */
  async eventRequest(_event: InputParams["event"], session: ISession, bag: IOManager.IOBag): Promise<Fulfillment> {
    console.info(TAG, "event request:", _event);

    const event = await this.eventRequestTransformer(_event, session);
    const response = await this.request({ event }, session, bag);
    const body = this.decodeDetectIntentResponse(response);
    return this.bodyParser(body, session, bag);
  }

  /**
   * The endpoint closure used by the webhook
   */
  async webhookEndpoint(req: Request, res: Response) {
    console.info(TAG, "[WEBHOOK]", "received request", req.body);

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        error: "ERR_EMPTY_BODY",
      });
    }

    const request = req.body as WebhookRequest;
    const sessionId = (request.session as string).split("/").pop();
    const session = (await IOManager.getSession(sessionId)) || (await IOManager.registerSession("webhook", sessionId));

    const body = this.decodeDetectIntentResponse(request);

    let fulfillment = await this.bodyParser(body, session, request.originalDetectIntentRequest?.payload, "[WEBHOOK]");
    fulfillment = await this.fulfillmentTransformerForSession(fulfillment, session);

    const response = fulfillment as WebhookResponse;
    // Add output context from the action
    response.outputContexts = body.queryResult.outputContexts;

    // Trick to use Google-Home only for recording, but forwarding output to my speaker
    // if (body.originalDetectIntentRequest?.source === "google") {
    //   IOManager.output(fulfillment, await IOManager.getSession("ottohome-human"));
    //   response.fulfillmentText = "  ";
    // }

    console.info(TAG, "[WEBHOOK]", "output", response);
    return res.status(200).json(response);
  }

  /**
   * Process a fulfillment to a session
   */
  async processInput(params: InputParams, session: ISession) {
    console.info(TAG, "processInput", { params, session });

    if (session.repeatModeSessions?.length > 0 && params.text) {
      console.info(TAG, "using repeatModeSessions", session.repeatModeSessions);
      return Promise.all(
        session.repeatModeSessions.map(async (e) => {
          const fulfillment = await this.fulfillmentTransformerForSession({ fulfillmentText: params.text }, e);
          return IOManager.output(fulfillment, e, params.bag);
        }),
      );
    }

    IOManager.writeLogForSession(params, session);

    let fulfillment: any = null;
    if (params.text) {
      fulfillment = await this.textRequest(params.text, session, params.bag);
    } else if (params.event) {
      fulfillment = await this.eventRequest(params.event, session, params.bag);
    } else if (params.audio) {
      const text = await SpeechRecognizer.recognizeFile(params.audio, session.getTranslateFrom());
      fulfillment = await this.textRequest(text, session, params.bag);
    } else if (params.command) {
      fulfillment = await this.commandRequest(params.command, session, params.bag);
    } else {
      console.warn("Neither { text, event, command, audio } in params are not null");
    }

    fulfillment = await this.fulfillmentTransformerForSession(fulfillment, session);
    return IOManager.output(fulfillment, session, params.bag);
  }
}

export default new AI(config().dialogflow);
