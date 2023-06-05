import dialogflow, { protos, SessionsClient, IntentsClient } from "@google-cloud/dialogflow";
import * as IOManager from "../iomanager";
import config from "../../config";
import { Fulfillment, CustomError, AIAction, InputParams, Session, FullfillmentStringKeys } from "../../types";
import { struct } from "pb-util";
import Events from "events";
import speechRecognizer from "../speech-recognizer";
import translator from "../translator";
import { Signale } from "signale";
import OpenAI from "../../lib/openai";
import { getSessionTranslateFrom, getSessionTranslateTo, isJsonString } from "../../helpers";
import { ChatCompletionRequestMessageRoleEnum } from "openai";
import { Interaction } from "../../data";
import { AICommander } from "./commander";

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

class AI {
  dfSessionClient: SessionsClient = new dialogflow.SessionsClient();
  dfIntentsClient: IntentsClient = new dialogflow.IntentsClient();

  emitter: Events.EventEmitter = new Events.EventEmitter();

  dfIntentAgentPath: string;
  commander: AICommander;

  constructor(private config: AIConfig) {
    this.dfIntentAgentPath = this.dfIntentsClient.projectAgentPath(this.config.dialogflow.projectId);
    this.commander = new AICommander();
  }

  /**
   * Transform a Fulfillment by making some edits based on the current session settings
   */
  async fulfillmentFinalizer(fulfillment: Fulfillment, session: Session): Promise<Fulfillment> {
    if (!fulfillment) return;

    console.log("Finalizing fuflillment", fulfillment);

    fulfillment.options = fulfillment.options || {};

    // If this fulfillment has already been transformed, let's skip this
    if (fulfillment.options.finalizerUid) {
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

    new Interaction({
      session: session.id,
      createdAt: new Date(),
      fulfillment: fulfillment,
    }).save();

    // Add other info
    fulfillment.options.finalizerUid = this.config.uid;
    fulfillment.options.finalizedAt = Date.now();
    fulfillment.options.sessionId = session.id;

    return fulfillment;
  }

  /**
   * Get the session path suitable for DialogFlow
   */
  getDfSessionPath(sessionId: string) {
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
  actionErrorFinalizer(error: CustomError): Fulfillment {
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
      const finalFulfillment = await this.fulfillmentFinalizer(fulfillment, session);
      const outputResult = await IOManager.output(finalFulfillment, session, bag);
      fulfillmentsAndOutputResults.push([finalFulfillment, outputResult]);
    }

    return fulfillmentsAndOutputResults;
  }

  /**
   * Transform a body from DialogFlow into a Fulfillment by calling the internal action
   */
  private async dfActionResolver(
    actionName: string,
    body: IDetectIntentResponse,
    session: Session,
    bag: IOManager.IOBag,
  ): Promise<Fulfillment> {
    console.info(`calling action <${actionName}>`);

    try {
      const [pkgName, pkgAction = "index"] = actionName.split(".");

      if (pkgName.includes("..") || pkgAction.includes("..")) {
        throw new Error(`Unsafe action name <${pkgName}.${pkgAction}>`);
      }

      const pkg = await import(`../packages/${pkgName}/${pkgAction}`);
      if (!pkg) {
        throw new Error(`Invalid action name <${pkgName}.${actionName}>`);
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
      return this.actionErrorFinalizer(err);
    }
  }

  extractMessages(fulfillmentMessages: protos.google.cloud.dialogflow.v2.Intent.IMessage[], key: string) {
    return fulfillmentMessages.find((m) => m?.payload?.fields?.[key] !== undefined)?.payload.fields[key].stringValue;
  }

  /**
   * Parse the DialogFlow body and decide what to do
   */
  private async dfBodyParser(
    body: IDetectIntentResponse,
    session: Session,
    bag: IOManager.IOBag,
    originalRequestType: "text" | "event",
  ): Promise<Fulfillment> {
    const { fulfillmentText, fulfillmentMessages } = body.queryResult;

    console.log("dfBodyParser", body.queryResult);

    // If we have an "action", call the package with the specified name
    if (body.queryResult.action) {
      console.debug(`Resolving action: ${body.queryResult.action}`);
      return this.dfActionResolver(body.queryResult.action, body, session, bag);
    }

    // Otherwise, check if at least an intent is match and direct return that fulfillment
    if (!body.queryResult.intent || body.queryResult.intent?.isFallback) {
      if (originalRequestType === "text") {
        return OpenAI().textRequest(body.queryResult.queryText, session);
      }
      return;
    }

    let maybeOpenAIPrompt = body.queryResult.fulfillmentMessages.find(
      (m) => m?.payload?.fields?.openai_prompt?.stringValue,
    )?.payload.fields?.openai_prompt?.stringValue;
    if (maybeOpenAIPrompt) {
      for (const [key, value] of Object.entries(body.queryResult.parameters.fields ?? [])) {
        maybeOpenAIPrompt = maybeOpenAIPrompt.replace(new RegExp(`{${key}}`, "g"), value.stringValue);
      }

      return OpenAI().textRequest(
        maybeOpenAIPrompt,
        session,
        originalRequestType === "text"
          ? ChatCompletionRequestMessageRoleEnum.User
          : ChatCompletionRequestMessageRoleEnum.System,
      );
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

  private async dfRequest(queryInput: IQueryInput, session: Session, bag?: IOManager.IOBag) {
    if (queryInput.text) {
      queryInput.text.text = await translator().translate(
        queryInput.text.text,
        this.config.dialogflow.language,
        getSessionTranslateFrom(session),
      );
    }

    const sessionPath = this.getDfSessionPath(session.id);
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

    new Interaction({
      session: session.id,
      createdAt: new Date(),
      input: { command: command },
    }).save();

    return this.commander.getCommandExecutor(command, session)(session, bag);
  }

  /**
   * Make a text request to DialogFlow and let the flow begin
   */
  async textRequest(text: InputParams["text"], session: Session, bag: IOManager.IOBag): Promise<Fulfillment> {
    console.info("[df] text request:", text);

    const queryInput: IQueryInput = { text: { text } };
    queryInput.text.languageCode = this.config.dialogflow.language;

    new Interaction({
      session: session.id,
      createdAt: new Date(),
      input: { text },
    }).save();

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

    new Interaction({
      session: session.id,
      createdAt: new Date(),
      input: { event: queryInput.event },
    }).save();

    const body = await this.dfRequest(queryInput, session, bag);
    return this.dfBodyParser(body, session, bag, "event");
  }

  async getFullfilmentForInput(params: InputParams, session: Session): Promise<Fulfillment> {
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

    return this.fulfillmentFinalizer(fulfillment, session);
  }

  /**
   * Process a fulfillment to a session
   */
  async processInput(params: InputParams, session: Session) {
    console.info("processInput", { params, session });

    // Check if we have repeatModeSessions - if so, just output to all of them
    if (session.repeatModeSessions?.length > 0 && params.text) {
      console.info("using repeatModeSessions", session.repeatModeSessions);
      return Promise.all(
        session.repeatModeSessions.map(async (e) => {
          const trFulfillment = await this.fulfillmentFinalizer({ text: params.text }, e);
          return IOManager.output(trFulfillment, e, params.bag);
        }),
      );
    }

    const fulfillment = await this.getFullfilmentForInput(params, session);
    return IOManager.output(fulfillment, session, params.bag);
  }
}

let _instance: AI;
export default (): AI => {
  _instance = _instance || new AI(config());
  return _instance;
};
