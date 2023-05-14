import dialogflow, { protos, SessionsClient, IntentsClient } from "@google-cloud/dialogflow";
import * as IOManager from "./iomanager";
import config from "../config";
import { Fulfillment, CustomError, AIAction, InputParams, Session, FullfillmentStringKeys } from "../types";
import { struct } from "pb-util";
import Events from "events";
import speechRecognizer from "../stdlib/speech-recognizer";
import translator from "../stdlib/translator";
import { Signale } from "signale";
import OpenAI from "../lib/openai";
import { getSessionTranslateFrom, getSessionTranslateTo, isJsonString } from "../helpers";

export type IDetectIntentResponse = protos.google.cloud.dialogflow.v2.IDetectIntentResponse;
export type IQueryInput = protos.google.cloud.dialogflow.v2.IQueryInput;

const TAG = "AI";
const console = new Signale({
  scope: TAG,
});

type AIConfig = {
  aiName: string;
  uid: string;
  language: string;
  trainingSessionId: string;
  dialogflow: {
    projectId: string;
    environment?: string;
    language: string;
  };
};

type CommandFunction = (args: RegExpMatchArray, session: Session, bag: IOManager.IOBag) => Promise<Fulfillment>;

class AI {
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
      matcher: /^\/start$/,
      executor: this.commandStart,
      description: "start - Start the bot",
      authorization: IOManager.Authorizations.COMMAND,
    },
    {
      matcher: /^\/textout ([^\s]+) (.+)/,
      executor: this.commandOut,
      description: "textout - [sessionid] [text] - Send a text message to a specific session",
      authorization: IOManager.Authorizations.COMMAND,
    },
    {
      matcher: /^\/eventin ([^\s]+) (.+)/,
      executor: this.eventIn,
      description:
        "eventin - [sessionid] [name] [event_object_or_name] - Process an input event for a specific session",
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

  constructor(private config: AIConfig) {
    this.dfIntentAgentPath = this.dfIntentsClient.projectAgentPath(this.config.dialogflow.projectId);
  }

  getCommandMappingDescription() {
    return this.commandMapping.map(({ description }) => `${description}`).join("\n");
  }

  private async commandNotAuthorized(): Promise<Fulfillment> {
    return { text: "User not authorized" };
  }

  private async commandNotFound(): Promise<Fulfillment> {
    return { text: "Command not found" };
  }

  private async commandAppStop(): Promise<Fulfillment> {
    setTimeout(() => process.exit(0), 5000);
    return { text: "Scheduled shutdown in 5 seconds" };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async commandStart(_: RegExpMatchArray, _session: Session): Promise<Fulfillment> {
    return { text: "HELO" };
  }

  private async commandWhoami(_: RegExpMatchArray, session: Session): Promise<Fulfillment> {
    return { data: JSON.stringify(session, null, 2) };
  }

  private async commandIn([, cmdSessionId, cmdText]: RegExpMatchArray): Promise<Fulfillment> {
    const cmdSession = await IOManager.getSession(cmdSessionId);
    const result = await this.processInput({ text: cmdText }, cmdSession);
    return { data: JSON.stringify(result, null, 2) };
  }

  private async eventIn([, cmdSessionId, cmdEvent]: RegExpMatchArray): Promise<Fulfillment> {
    const cmdSession = await IOManager.getSession(cmdSessionId);
    const event = isJsonString(cmdEvent) ? JSON.parse(cmdEvent) : cmdEvent;
    const result = await this.processInput({ event: event }, cmdSession);
    return { data: JSON.stringify(result, null, 2) };
  }

  private async commandOut([, cmdSessionId, cmdText]: RegExpMatchArray): Promise<Fulfillment> {
    const cmdSession = await IOManager.getSession(cmdSessionId);
    const result = await IOManager.output({ text: cmdText }, cmdSession, {});
    return { data: JSON.stringify(result, null, 2) };
  }

  getCommandExecutor(text: string, session: Session): (session: Session, bag: IOManager.IOBag) => Promise<Fulfillment> {
    for (const cmd of this.commandMapping) {
      const matches = text.match(cmd.matcher);
      if (matches) {
        if (
          session.authorizations.includes(cmd.authorization) ||
          session.authorizations.includes(IOManager.Authorizations.ADMIN) ||
          cmd.authorization == null
        ) {
          return (session: Session, bag: IOManager.IOBag) => cmd.executor.call(this, matches, session, bag);
        } else {
          return () => this.commandNotAuthorized();
        }
      }
    }

    return () => this.commandNotFound();
  }

  async train(queryText: string, answer: string) {
    console.debug("TRAIN request", { queryText, answer });
    const response = await this.dfIntentsClient.createIntent({
      parent: this.dfIntentAgentPath,
      languageCode: this.config.dialogflow.language,
      intent: {
        displayName: `M-TRAIN: ${queryText}`.substring(0, 100),
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
      },
    });
    console.debug("TRAIN response", response);
    return response;
  }

  /**
   * Transform a Fulfillment by making some edits based on the current session settings
   */
  async fulfillmentTransformerForSession(fulfillment: Fulfillment, session: Session): Promise<Fulfillment> {
    if (!fulfillment) return;

    fulfillment.options = fulfillment.options || {};

    // If this fulfillment has already been transformed, let's skip this
    if (fulfillment.options.transformerUid) {
      return fulfillment;
    }

    // Always translate fulfillment speech in the user language
    if (fulfillment.text) {
      const fromLanguage = fulfillment.options.translateFrom ?? this.config.language;
      const toLanguage = fulfillment.options.translateTo || getSessionTranslateTo(session);
      if (toLanguage !== fromLanguage) {
        try {
          fulfillment.text = await translator().translate(fulfillment.text, toLanguage, fromLanguage);
        } catch (err) {
          fulfillment.text += ` [untranslated]`;
        }
      }
    }

    fulfillment.options.transformerUid = this.config.uid;
    fulfillment.options.transformedAt = Date.now();

    return fulfillment;
  }

  /**
   * Get the session path suitable for DialogFlow
   */
  getDFSessionPath(sessionId: string) {
    const dfSessionId = sessionId.replace(/\//g, "_");
    if (!this.config.dialogflow.environment) {
      return this.dfSessionClient.projectAgentSessionPath(this.config.dialogflow.projectId, dfSessionId);
    }

    return this.dfSessionClient.projectAgentEnvironmentUserSessionPath(
      this.config.dialogflow.projectId,
      this.config.dialogflow.environment,
      "-",
      dfSessionId,
    );
  }

  /**
   * Transform an error into a fulfillment
   */
  actionErrorTransformer(error: CustomError): Fulfillment {
    const fulfillment: Fulfillment = {};
    fulfillment.error = error;
    return fulfillment;
  }

  /**
   * Accept a Generation action and resolve all outputs
   */
  async generatorResolver(
    fulfillmentGenerator: IterableIterator<Fulfillment>,
    session: Session,
    bag: IOManager.IOBag,
  ): Promise<[Fulfillment, IOManager.OutputResult][]> {
    console.info("Using generator resolver", fulfillmentGenerator);

    const fulfillmentsAndOutputResults: [Fulfillment, IOManager.OutputResult][] = [];

    for await (const fulfillment of fulfillmentGenerator) {
      const trFulfillment = await this.fulfillmentTransformerForSession(fulfillment, session);
      const outputResult = await IOManager.output(trFulfillment, session, bag);
      fulfillmentsAndOutputResults.push([trFulfillment, outputResult]);
    }

    return fulfillmentsAndOutputResults;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleSystemPackages(pkgName: string, body: IDetectIntentResponse, _session: Session): Fulfillment | null {
    const { queryResult } = body;

    switch (pkgName) {
      case "train":
        this.train(queryResult.outputContexts?.[0]?.parameters?.fields?.queryText?.stringValue, queryResult.queryText);
        return body.queryResult;
      default:
        return null;
    }
  }

  /**
   * Transform a body from DialogFlow into a Fulfillment by calling the internal action
   */
  async actionResolver(
    actionName: string,
    body: IDetectIntentResponse,
    session: Session,
    bag: IOManager.IOBag,
  ): Promise<Fulfillment> {
    console.info(`calling action <${actionName}>`);

    try {
      const [pkgName, pkgAction = "index"] = actionName.split(".");

      const sysPkgFullfillment = this.handleSystemPackages(pkgName, body, session);
      if (sysPkgFullfillment !== null) {
        return sysPkgFullfillment;
      }

      // TODO: avoid possible code injection
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
          this.generatorResolver(actionResult as IterableIterator<Fulfillment>, session, bag);
        });

        // And immediately resolve
        return {
          options: {
            handledByGenerator: true,
          },
        };
      } else {
        return actionResult as Fulfillment;
      }
    } catch (err) {
      console.error("error while executing action", err);
      return this.actionErrorTransformer(err);
    }
  }

  async invokeTrain(queryText: string) {
    const { trainingSessionId } = this.config;

    if (this.config.trainingSessionId) {
      console.debug(`Training invoked on sessionId ${trainingSessionId}`);

      const trainingSession = await IOManager.getSession(trainingSessionId);
      if (!trainingSession) {
        console.error(`Unable to find traning session ID (${trainingSessionId})`);
        return;
      }
      this.processInput(
        {
          event: { name: "training", parameters: { queryText } },
        },
        trainingSession,
      );
    }
  }

  extractMessages(fulfillmentMessages: protos.google.cloud.dialogflow.v2.Intent.IMessage[], key: string) {
    return fulfillmentMessages.find((m) => m?.payload?.fields?.[key] !== undefined)?.payload.fields[key].stringValue;
  }

  /**
   * Parse the DialogFlow body and decide what to do
   */
  async dfBodyParser(
    body: IDetectIntentResponse,
    session: Session,
    bag: IOManager.IOBag,
    originalRequestType: "text" | "event",
  ): Promise<Fulfillment> {
    const { fulfillmentText, fulfillmentMessages } = body.queryResult;

    // If we have an "action", call the package with the specified name
    if (body.queryResult.action) {
      console.debug(`Resolving action: ${body.queryResult.action}`);
      return this.actionResolver(body.queryResult.action, body, session, bag);
    }

    // Otherwise, check if at least an intent is match and direct return that fulfillment
    if (!body.queryResult.intent) {
      return OpenAI().textRequest(body.queryResult.queryText, session);
    }

    console.debug(
      TAG,
      "Using body.queryResult object (matched from intent)",
      JSON.stringify(body.queryResult, null, 2),
    );

    // Treat fallback intent as null
    if (body.queryResult.intent.isFallback) {
      return OpenAI().textRequest(body.queryResult.queryText, session);
    }

    let maybeOpenAIPrompt = body.queryResult.fulfillmentMessages.find(
      (m) => m?.payload?.fields?.openai_prompt?.stringValue,
    )?.payload.fields?.openai_prompt?.stringValue;
    if (maybeOpenAIPrompt) {
      for (const [key, value] of Object.entries(body.queryResult.parameters.fields ?? [])) {
        maybeOpenAIPrompt = maybeOpenAIPrompt.replace(new RegExp(`{${key}}`, "g"), value.stringValue);
      }
      const addToHistory = originalRequestType === "text";
      return OpenAI().textRequest(maybeOpenAIPrompt, session, addToHistory);
    }

    // Otherwise, just remap our common keys as standard object
    return {
      text: fulfillmentText,
      ...FullfillmentStringKeys.reduce((acc, key) => {
        const value = this.extractMessages(fulfillmentMessages, key);
        if (value) acc[key] = value;
        return acc;
      }, {}),
    } as Fulfillment;
  }

  async dfRequest(queryInput: IQueryInput, session: Session, bag?: IOManager.IOBag) {
    if (queryInput.text) {
      queryInput.text.text = await translator().translate(
        queryInput.text.text,
        this.config.dialogflow.language,
        getSessionTranslateFrom(session),
      );
    }

    const sessionPath = this.getDFSessionPath(session.id);
    const payload = {
      session: sessionPath,
      queryInput,
      queryParams: {
        payload: bag?.encodable ? struct.encode(bag.encodable) : {},
      },
    };
    const [response] = await this.dfSessionClient.detectIntent(payload);

    return response;
  }

  /**
   * Get the command to execute and return an executor
   */
  async commandRequest(command: InputParams["command"], session: Session, bag: IOManager.IOBag): Promise<Fulfillment> {
    console.info("command request:", command);

    const commandExecutor = this.getCommandExecutor(command, session);
    try {
      return commandExecutor(session, bag);
    } catch (err) {
      return { error: err };
    }
  }

  /**
   * Make a text request to DialogFlow and let the flow begin
   */
  async textRequest(text: InputParams["text"], session: Session, bag: IOManager.IOBag): Promise<Fulfillment> {
    console.info("[df] text request:", text);

    const queryInput: IQueryInput = { text: { text } };
    queryInput.text.languageCode = this.config.dialogflow.language;

    const body = await this.dfRequest(queryInput, session, bag);
    return this.dfBodyParser(body, session, bag, "text");
  }

  /**
   * Make an event request to DialogFlow and let the flow begin
   */
  async eventRequest(event: InputParams["event"], session: Session, bag: IOManager.IOBag): Promise<Fulfillment> {
    console.info("[df] event request:", event);

    const queryInput: IQueryInput = { event: {} };

    if (typeof event === "string") {
      queryInput.event.name = event;
    } else {
      queryInput.event.name = event.name;
      queryInput.event.parameters = event.parameters ? struct.encode(event.parameters) : {};
    }
    queryInput.event.languageCode = this.config.dialogflow.language;

    const body = await this.dfRequest(queryInput, session, bag);
    return this.dfBodyParser(body, session, bag, "event");
  }

  /**
   * Process a fulfillment to a session
   */
  async processInput(params: InputParams, session: Session) {
    console.info("processInput", { params, session });

    if (session.repeatModeSessions?.length > 0 && params.text) {
      console.info("using repeatModeSessions", session.repeatModeSessions);
      return Promise.all(
        session.repeatModeSessions.map(async (e) => {
          const trFulfillment = await this.fulfillmentTransformerForSession({ text: params.text }, e);
          return IOManager.output(trFulfillment, e, params.bag);
        }),
      );
    }

    // IOManager.writeLogForSession(params, session);

    let fulfillment: any = null;
    if (params.text) {
      fulfillment = await this.textRequest(params.text, session, params.bag);
    } else if (params.event) {
      fulfillment = await this.eventRequest(params.event, session, params.bag);
    } else if (params.audio) {
      const text = await speechRecognizer().recognizeFile(params.audio, getSessionTranslateFrom(session));
      fulfillment = await this.textRequest(text, session, params.bag);
    } else if (params.command) {
      fulfillment = await this.commandRequest(params.command, session, params.bag);
    } else if (params.repeatText) {
      fulfillment = { text: params.repeatText };
    } else {
      console.warn("Neither { text, event, command, repeatText, audio } in params are not null");
    }

    const trFulfillment = await this.fulfillmentTransformerForSession(fulfillment, session);
    return IOManager.output(trFulfillment, session, params.bag);
  }
}

let _instance: AI;
export default (): AI => {
  _instance = _instance || new AI(config());
  return _instance;
};
